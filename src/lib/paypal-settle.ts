import 'server-only';
import { prisma } from './db';
import { capturePaypalOrder } from './paypal';
import { changeOrderStatus, orderMailPayload } from './order-ops';
import { logOrderEvent } from './orders';
import { sendAdminNewOrder } from './mail';
import { OutOfStockError, releaseOrderReservation, reserveOrderStock } from './reservations';

export type PaypalSettleOutcome =
  | 'not_found'
  | 'paid'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'out_of_stock'
  | 'error';

/**
 * Cobra una orden de PayPal aprobada y deja el pedido pagado.
 *
 * Hay dos puertas que llegan acá: el retorno del comprador a la tienda y el
 * webhook de PayPal, que avisa aunque el comprador haya cerrado el navegador
 * antes de volver. Las dos pueden llegar al mismo tiempo, así que el cobro se
 * serializa con un bloqueo por orden de PayPal: la segunda espera y encuentra
 * el pedido ya pagado.
 *
 * Antes de capturar se revisa el stock. Si la reserva venció y otra compra se
 * llevó la talla, no se captura: el comprador no paga nada y la orden de
 * PayPal vence sola.
 */
export async function settlePaypalOrder(
  paypalOrderId: string,
  actor: string,
): Promise<{ outcome: PaypalSettleOutcome; orderNumber: string | null }> {
  return prisma.$transaction(
    async (tx) => {
      // Solo sostiene el bloqueo; el trabajo usa sus propias transacciones
      // para que cada paso quede escrito apenas termina.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`paypal:${paypalOrderId}`}))`;
      return settleLocked(paypalOrderId, actor);
    },
    { maxWait: 15_000, timeout: 60_000 },
  );
}

async function settleLocked(
  paypalOrderId: string,
  actor: string,
): Promise<{ outcome: PaypalSettleOutcome; orderNumber: string | null }> {
  const order = await prisma.order.findFirst({ where: { paypalOrderId } });
  if (!order) return { outcome: 'not_found', orderNumber: null };
  const orderNumber = order.number;
  if (order.paymentStatus === 'APPROVED') return { outcome: 'paid', orderNumber };
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_update',
      message: 'PayPal avisó un pago aprobado de un pedido cancelado: no se cobró.',
      actor,
    });
    return { outcome: 'cancelled', orderNumber };
  }

  // Sin reserva vigente (venció o se soltó) se intenta apartar de nuevo.
  if (!order.stockReserved && !order.stockCommitted) {
    try {
      await prisma.$transaction((tx) => reserveOrderStock(tx, order.id, new Date(Date.now() + 10 * 60 * 1000)));
    } catch (error) {
      if (!(error instanceof OutOfStockError)) throw error;
      await logOrderEvent({
        orderId: order.id,
        type: 'payment_out_of_stock',
        message:
          `El cliente aprobó el pago en PayPal después de vencida la reserva y ${error.sku} ya no tenía stock. ` +
          'No se capturó el cobro.',
        actor,
      });
      return { outcome: 'out_of_stock', orderNumber };
    }
  }

  let capture: Awaited<ReturnType<typeof capturePaypalOrder>>;
  try {
    capture = await capturePaypalOrder(paypalOrderId);
  } catch (error) {
    console.error('[paypal:captura]', error);
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_error',
      message: 'No se pudo capturar el pago en PayPal.',
      actor,
    });
    return { outcome: 'error', orderNumber };
  }

  if (capture.orderId && capture.orderId !== order.id) {
    console.error('[paypal] la orden de PayPal no corresponde al pedido', paypalOrderId, order.id);
    return { outcome: 'error', orderNumber };
  }

  await logOrderEvent({
    orderId: order.id,
    type: 'payment_update',
    message: `PayPal informó el cobro ${capture.captureId ?? paypalOrderId} como ${capture.status}.`,
    actor,
    payload: capture,
  });

  if (capture.status !== 'COMPLETED') {
    // PENDING: PayPal lo está revisando y la reserva se mantiene hasta que
    // resuelva. Cualquier otro estado es un cobro rechazado.
    const pending = capture.status === 'PENDING';
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: pending ? 'IN_PROCESS' : 'REJECTED', paypalCaptureId: capture.captureId },
    });
    if (!pending) await prisma.$transaction((tx) => releaseOrderReservation(tx, order.id));
    return { outcome: pending ? 'pending' : 'rejected', orderNumber };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paypalCaptureId: capture.captureId,
      chargedCurrency: capture.currency ?? order.chargedCurrency,
      chargedCents: capture.cents ?? order.chargedCents,
    },
  });
  const changed = await changeOrderStatus({ orderId: order.id, status: 'PAID', actor });
  if (changed.ok) {
    const payload = await orderMailPayload(order.id);
    if (payload) await sendAdminNewOrder(payload).catch(() => {});
  }
  return { outcome: 'paid', orderNumber };
}
