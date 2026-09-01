import { NextResponse, type NextRequest } from 'next/server';
import type { PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPayment, verifyWebhookSignature } from '@/lib/mercadopago';
import { commitStockForOrder, restoreStockForOrder } from '@/lib/inventory';
import { logOrderEvent } from '@/lib/orders';
import {
  sendAdminNewOrder,
  sendOrderPaid,
  sendOrderCancelled,
  sendOrderRefunded,
  type OrderMailData,
} from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook de Mercado Pago.
 *
 * Reglas de oro:
 *  1. Siempre responder 200 rápido; MP reintenta ante cualquier otro código
 *     y podría duplicar el procesamiento.
 *  2. Nunca confiar en el cuerpo del webhook: se consulta el pago contra la API.
 *  3. Ser idempotente: MP envía la misma notificación varias veces.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const url = new URL(request.url);
  const type = String(body.type ?? body.topic ?? url.searchParams.get('type') ?? '');
  const dataId =
    (body.data as { id?: string | number } | undefined)?.id?.toString() ??
    url.searchParams.get('data.id') ??
    url.searchParams.get('id');

  if (!type.includes('payment') || !dataId) {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const validSignature = verifyWebhookSignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
  });
  if (!validSignature) {
    console.warn('[mp-webhook] firma inválida para el pago', dataId);
    return NextResponse.json({ received: true, invalid: true }, { status: 200 });
  }

  try {
    await processPayment(dataId);
  } catch (error) {
    // Se registra pero se responde 200: reintentar no arregla un error de datos.
    console.error('[mp-webhook:error]', error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/** Mercado Pago también consulta con GET para validar la URL. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

async function processPayment(paymentId: string) {
  const payment = await getPayment(paymentId);
  if (!payment) return;

  const order = payment.externalReference
    ? await prisma.order.findUnique({
        where: { id: payment.externalReference },
        include: { items: true },
      })
    : null;

  if (!order) {
    console.warn('[mp-webhook] pago sin pedido asociado', paymentId, payment.externalReference);
    return;
  }

  // Idempotencia: si el estado no cambió, no se vuelve a procesar.
  if (order.mpPaymentId === payment.id && order.paymentStatus === payment.status) return;

  const previous = order.paymentStatus;

  const statusMap: Record<PaymentStatus, { status: typeof order.status; paidAt?: Date | null }> = {
    APPROVED: { status: 'PAID', paidAt: new Date() },
    PENDING: { status: 'PENDING' },
    IN_PROCESS: { status: 'PENDING' },
    REJECTED: { status: 'PENDING' },
    CANCELLED: { status: 'CANCELLED' },
    REFUNDED: { status: 'REFUNDED' },
    CHARGED_BACK: { status: 'REFUNDED' },
  };
  const mapped = statusMap[payment.status];

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: payment.status,
      status: mapped.status,
      mpPaymentId: payment.id,
      mpStatusDetail: payment.statusDetail,
      mpPaymentType: payment.paymentTypeId,
      mpInstallments: payment.installments,
      ...(mapped.paidAt ? { paidAt: mapped.paidAt } : {}),
    },
  });

  await logOrderEvent({
    orderId: order.id,
    type: 'payment_update',
    message: `Mercado Pago informó el pago ${payment.id} como ${payment.status}${
      payment.statusDetail ? ` (${payment.statusDetail})` : ''
    }.`,
    actor: 'Mercado Pago',
    payload: {
      paymentId: payment.id,
      status: payment.status,
      statusDetail: payment.statusDetail,
      amount: payment.transactionAmount,
    },
  });

  // Los datos del correo salen del mismo pedido en ambos caminos: pago
  // acreditado y reversión.
  const mailData: OrderMailData = {
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
    items: order.items,
  };

  // El stock se descuenta una sola vez, al pasar a aprobado.
  if (payment.status === 'APPROVED' && previous !== 'APPROVED') {
    await commitStockForOrder(order.id);

    if (order.couponId) {
      await prisma.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await Promise.allSettled([sendOrderPaid(mailData), sendAdminNewOrder(mailData)]);
  }

  // Si un pago aprobado se revierte, el stock vuelve al inventario.
  if (
    previous === 'APPROVED' &&
    (payment.status === 'REFUNDED' || payment.status === 'CHARGED_BACK' || payment.status === 'CANCELLED')
  ) {
    await restoreStockForOrder(order.id, 'RETURN');
    await logOrderEvent({
      orderId: order.id,
      type: 'stock_restored',
      message: 'Stock devuelto al inventario tras la reversión del pago.',
      actor: 'Sistema',
    });

    // Al cliente le cambió la plata: se entera por correo, no entrando al
    // panel. Un pago anulado se cuenta como cancelación; devuelto o
    // contracargado, como reembolso.
    const aviso = payment.status === 'CANCELLED' ? sendOrderCancelled : sendOrderRefunded;
    await aviso(mailData).catch(() => {});
  }
}
