'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logOrderEvent, ORDER_STATUS_LABEL } from '@/lib/orders';
import { commitStockForOrder, restoreStockForOrder } from '@/lib/inventory';
import { trackingUrlFor } from '@/lib/shipping';
import {
  mailTransport,
  sendOrderShipped,
  sendOrderPaid,
  sendOrderProcessing,
  sendOrderDelivered,
  sendOrderCancelled,
  sendOrderRefunded,
  type OrderMailData,
} from '@/lib/mail';
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
/**
 * Qué correo acompaña a cada estado.
 *
 * Los que no aparecen no avisan: PENDING ya lo cubre el correo de pedido
 * recibido que sale del propio checkout.
 */
const AVISO_POR_ESTADO: Partial<Record<OrderStatus, (order: OrderMailData) => Promise<unknown>>> = {
  PROCESSING: sendOrderProcessing,
  SHIPPED: sendOrderShipped,
  DELIVERED: sendOrderDelivered,
  CANCELLED: sendOrderCancelled,
  REFUNDED: sendOrderRefunded,
};

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

  // Aviso al cliente en cada cambio de estado.
  const payload = await mailPayload(id);
  if (payload) {
    // PAID va aparte: solo se avisa si el pago no venía ya aprobado, porque
    // en ese caso el webhook de Mercado Pago ya mandó su propio correo.
    const aviso =
      status === 'PAID'
        ? order.paymentStatus !== 'APPROVED'
          ? sendOrderPaid
          : null
        : (AVISO_POR_ESTADO[status] ?? null);
    if (aviso) await aviso(payload).catch(() => {});
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

export async function updateOrderItem(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '').trim();
  const itemId = String(formData.get('itemId') ?? '').trim();
  const variantId = String(formData.get('variantId') ?? '').trim();

  if (!orderId || !itemId || !variantId) {
    return { ok: false, message: 'Datos incompletos.' };
  }

  const [currentItem, newVariant] = await Promise.all([
    prisma.orderItem.findUnique({ where: { id: itemId } }),
    prisma.variant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
        color: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      },
    }),
  ]);

  if (!currentItem || currentItem.orderId !== orderId) {
    return { ok: false, message: 'Ítem no encontrado en este pedido.' };
  }
  if (!newVariant) {
    return { ok: false, message: 'Variante no encontrada.' };
  }

  const imageUrl = newVariant.color.images[0]?.url ?? currentItem.imageUrl;
  const unitPrice = newVariant.priceOverride ?? newVariant.product.basePrice;

  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      variantId: newVariant.id,
      productId: newVariant.productId,
      productName: newVariant.product.name,
      colorName: newVariant.color.name,
      size: newVariant.size,
      sku: newVariant.sku,
      imageUrl,
      unitPrice,
      lineTotal: unitPrice * currentItem.quantity,
    },
  });

  await logOrderEvent({
    orderId,
    type: 'item_change',
    message: `Producto cambiado: ${currentItem.productName} ${currentItem.colorName} T.${currentItem.size} → ${newVariant.product.name} ${newVariant.color.name} T.${newVariant.size}.`,
    actor: admin.email,
  });

  revalidateOrder(orderId);
  return { ok: true, message: 'Producto actualizado.' };
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

/** Avisos operativos explícitos: nunca cambian el estado ni el inventario. */
export async function sendBulkOrderUpdates(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = z.array(z.string().min(1)).min(1).max(25).safeParse(formData.getAll('orderIds'));
  if (!parsed.success) return { ok: false, message: 'Selecciona entre 1 y 25 pedidos.' };
  if (mailTransport() === 'none') return { ok: false, message: 'Configura Resend o SMTP en Ajustes antes de enviar correos.' };
  const ids = [...new Set(parsed.data)];
  const results: string[] = [];
  let sent = 0;
  for (const id of ids) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { results.push('Pedido no encontrado.'); continue; }
    const sender = order.status === 'PROCESSING' ? sendOrderProcessing
      : order.status === 'SHIPPED' ? sendOrderShipped
      : order.status === 'DELIVERED' ? sendOrderDelivered : null;
    if (!sender || (order.status === 'SHIPPED' && (order.isPickup || !order.trackingNumber))) {
      results.push(`${order.number}: omitido; requiere preparación, entrega o despacho con seguimiento.`);
      continue;
    }
    try {
      const payload = await mailPayload(id);
      const result = payload ? await sender(payload, { force: true }) : undefined;
      if (!result || result.skipped) {
        results.push(`${order.number}: no enviado; revisa la configuración del correo.`);
      } else {
        sent++;
        results.push(`${order.number}: aceptado por el proveedor.`);
        await logOrderEvent({ orderId: id, type: 'email_sent', message: `Aviso de ${ORDER_STATUS_LABEL[order.status].toLowerCase()} aceptado por el proveedor.`, actor: admin.email });
      }
    } catch {
      results.push(`${order.number}: error al procesar el aviso; revisa su historial antes de reintentar.`);
    }
    // Respetar el límite habitual de dos solicitudes por segundo de Resend.
    await new Promise((resolve) => setTimeout(resolve, 600));
    revalidateOrder(id);
  }
  return { ok: sent === ids.length, message: `${sent} de ${ids.length} correos aceptados por el proveedor. ${results.join(' ')}` };
}
