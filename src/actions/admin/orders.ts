'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logOrderEvent } from '@/lib/orders';
import { restoreStockForOrder } from '@/lib/inventory';
import { changeOrderStatus, resolveTransfer, saveOrderTracking } from '@/lib/order-ops';
import { mailTransport, sendMail } from '@/lib/mail';
import { refundPayment } from '@/lib/mercadopago';
import type { AdminState } from './products';

function revalidateOrder(id: string) {
  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/cuenta/pedidos');
}

export async function updateOrderStatus(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get('orderId') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;

  const result = await changeOrderStatus({ orderId: id, status, actor: admin.email });
  if (result.ok) revalidateOrder(id);
  return result;
}

/** Confirma el abono de una transferencia o la rechaza. */
export async function decideTransfer(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get('orderId') ?? '');
  const decision = formData.get('decision') === 'reject' ? 'reject' : 'confirm';
  const reference = String(formData.get('reference') ?? '');

  const result = await resolveTransfer({ orderId: id, decision, reference, actor: admin.email });
  if (result.ok) revalidateOrder(id);
  return result;
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

  const result = await saveOrderTracking({
    orderId: d.orderId,
    carrier: d.carrier,
    trackingNumber: d.trackingNumber,
    markShipped: d.markShipped === 'on',
    actor: admin.email,
  });
  if (result.ok) revalidateOrder(d.orderId);
  return result;
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

/** Correo personalizado a los destinatarios de pedidos seleccionados. */
export async function sendBulkOrderEmail(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = z.array(z.string().min(1)).min(1).max(25).safeParse(formData.getAll('orderIds'));
  if (!parsed.success) return { ok: false, message: 'Selecciona entre 1 y 25 pedidos.' };
  const message = z.object({
    subject: z.string().trim().min(1, 'Escribe un asunto.').max(200).refine((value) => !/[\r\n]/.test(value), 'El asunto debe ocupar una sola línea.'),
    content: z.string().trim().min(1, 'Escribe el mensaje.').max(100000, 'El mensaje es demasiado largo.'),
    format: z.enum(['text', 'html']),
  }).safeParse(Object.fromEntries(formData));
  if (!message.success) return { ok: false, message: message.error.issues[0]?.message ?? 'Revisa el mensaje.' };
  const { subject, content, format } = message.data;
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  const html = format === 'html' ? content : `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${escape(content)}</div>`;
  if (mailTransport() === 'none') return { ok: false, message: 'Configura Resend o SMTP en Ajustes antes de enviar correos.' };
  const ids = [...new Set(parsed.data)];
  const results: string[] = [];
  let sent = 0;
  for (const id of ids) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { results.push('Pedido no encontrado.'); continue; }
    try {
      const result = await sendMail({ to: order.email, subject, html, ...(format === 'text' ? { text: content } : {}) });
      if (!result || result.skipped) {
        results.push(`${order.number}: no enviado; revisa la configuración del correo.`);
      } else {
        sent++;
        results.push(`${order.number}: aceptado por el proveedor.`);
        await logOrderEvent({ orderId: id, type: 'email_sent', message: `Correo personalizado «${subject}» aceptado por el proveedor.`, actor: admin.email });
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
