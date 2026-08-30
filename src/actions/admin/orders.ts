'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logOrderEvent, ORDER_STATUS_LABEL } from '@/lib/orders';
import { commitStockForOrder, restoreStockForOrder } from '@/lib/inventory';
import { trackingUrlFor } from '@/lib/shipping';
import { sendOrderShipped, sendOrderPaid } from '@/lib/mail';
import { refundPayment } from '@/lib/mercadopago';
import type { AdminState } from './products';

function revalidateOrder(id: string) {
  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/cuenta/pedidos');
}

async function mailPayload(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;
  return {
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    shippingLabel: order.shippingLabel,
    isPickup: order.isPickup,
    street: order.street,
    streetNumber: order.streetNumber,
    commune: order.commune,
    region: order.region,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrier: order.shippingCarrier,
    items: order.items,
  };
}

/**
 * Cambia el estado del pedido y sincroniza el inventario.
 * Marcar como pagado descuenta stock; cancelar lo devuelve.
 */
export async function updateOrderStatus(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get('orderId') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  if (order.status === status) return { ok: true, message: 'El pedido ya estaba en ese estado.' };

  const wasCommitted = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const willCommit = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(status);

  await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === 'PAID' && order.paymentStatus !== 'APPROVED'
        ? { paymentStatus: 'APPROVED', paidAt: new Date() }
        : {}),
      ...(status === 'SHIPPED' && !order.shippedAt ? { shippedAt: new Date() } : {}),
      ...(status === 'DELIVERED' && !order.deliveredAt ? { deliveredAt: new Date() } : {}),
    },
  });

  if (!wasCommitted && willCommit) await commitStockForOrder(id);
  if (wasCommitted && (status === 'CANCELLED' || status === 'REFUNDED')) {
    await restoreStockForOrder(id, status === 'REFUNDED' ? 'RETURN' : 'CANCEL');
  }

  await logOrderEvent({
    orderId: id,
    type: 'status_change',
    message: `Estado cambiado a ${ORDER_STATUS_LABEL[status]}.`,
    actor: admin.email,
  });

  // Avisos al cliente en los cambios que le importan.
  const payload = await mailPayload(id);
  if (payload) {
    if (status === 'SHIPPED') await sendOrderShipped(payload).catch(() => {});
    if (status === 'PAID' && order.paymentStatus !== 'APPROVED') await sendOrderPaid(payload).catch(() => {});
  }

  revalidateOrder(id);
  return { ok: true, message: `Pedido marcado como ${ORDER_STATUS_LABEL[status].toLowerCase()}.` };
}

const trackingSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().optional(),
  trackingNumber: z.string().min(3, 'Ingresa el número de seguimiento.'),
  markShipped: z.string().optional(),
});

export async function saveTracking(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = trackingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: d.orderId } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };

  const carrier = d.carrier?.trim() || order.shippingCarrier || 'Chilexpress';
  const tracking = d.trackingNumber.trim();
  const shouldShip = d.markShipped === 'on';

  await prisma.order.update({
    where: { id: d.orderId },
    data: {
      shippingCarrier: carrier,
      trackingNumber: tracking,
      trackingUrl: trackingUrlFor(carrier, tracking),
      ...(shouldShip ? { status: 'SHIPPED', shippedAt: order.shippedAt ?? new Date() } : {}),
    },
  });

  await logOrderEvent({
    orderId: d.orderId,
    type: 'tracking',
    message: `Seguimiento ${carrier} ${tracking} cargado${shouldShip ? ' y pedido marcado como despachado' : ''}.`,
    actor: admin.email,
  });

  if (shouldShip) {
    const payload = await mailPayload(d.orderId);
    if (payload) await sendOrderShipped(payload).catch(() => {});
  }

  revalidateOrder(d.orderId);
  return {
    ok: true,
    message: shouldShip
      ? 'Seguimiento guardado y correo de despacho enviado al cliente.'
      : 'Seguimiento guardado.',
  };
}

export async function saveOrderNote(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get('orderId') ?? '');
  const note = String(formData.get('adminNote') ?? '').trim();

  await prisma.order.update({ where: { id }, data: { adminNote: note || null } });
  await logOrderEvent({
    orderId: id,
    type: 'note',
    message: note ? 'Nota interna actualizada.' : 'Nota interna eliminada.',
    actor: admin.email,
  });

  revalidateOrder(id);
  return { ok: true, message: 'Nota guardada.' };
}

/** Reembolso a través de Mercado Pago. Total si no se indica monto. */
export async function refundOrder(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get('orderId') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  if (!order.mpPaymentId) {
    return { ok: false, message: 'Este pedido no tiene un pago de Mercado Pago asociado.' };
  }
  if (order.paymentStatus !== 'APPROVED') {
    return { ok: false, message: 'Solo se pueden reembolsar pagos aprobados.' };
  }

  const amount = amountRaw ? Number(amountRaw.replace(/\D/g, '')) : undefined;
  if (amount != null && (amount <= 0 || amount > order.total)) {
    return { ok: false, message: 'El monto debe estar entre 1 y el total del pedido.' };
  }

  try {
    await refundPayment(order.mpPaymentId, amount);
  } catch (error) {
    console.error('[refund:error]', error);
    return { ok: false, message: 'Mercado Pago rechazó el reembolso. Revisa el panel de Mercado Pago.' };
  }

  const isPartial = amount != null && amount < order.total;
  if (!isPartial) {
    await prisma.order.update({
      where: { id },
      data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
    });
    await restoreStockForOrder(id, 'RETURN');
  }

  await logOrderEvent({
    orderId: id,
    type: 'refund',
    message: isPartial
      ? `Reembolso parcial de ${amount} CLP procesado.`
      : 'Reembolso total procesado. Stock devuelto al inventario.',
    actor: admin.email,
  });

  revalidateOrder(id);
  return {
    ok: true,
    message: isPartial ? 'Reembolso parcial procesado.' : 'Reembolso total procesado.',
  };
}
