import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { capturePaypalOrder } from '@/lib/paypal';
import { siteUrl } from '@/lib/mercadopago';
import { changeOrderStatus, orderMailPayload } from '@/lib/order-ops';
import { logOrderEvent } from '@/lib/orders';
import { sendAdminNewOrder } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/**
 * PayPal devuelve aquí al comprador con ?token=<id de la orden de PayPal>.
 * Se captura el cobro y, si quedó completado, el pedido pasa a pagado por el
 * mismo camino que una transferencia confirmada: stock, cupón y correos.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const order = token ? await prisma.order.findFirst({ where: { paypalOrderId: token } }) : null;
  if (!token || !order) return NextResponse.redirect(`${siteUrl()}/carrito`);

  const result = `${siteUrl()}/checkout/resultado?order=${order.number}`;
  if (order.paymentStatus === 'APPROVED') return NextResponse.redirect(result);

  try {
    const capture = await capturePaypalOrder(token);
    if (capture.orderId && capture.orderId !== order.id) {
      console.error('[paypal:retorno] la orden de PayPal no corresponde al pedido', token, order.id);
      return NextResponse.redirect(`${result}&estado=paypal-error`);
    }

    await logOrderEvent({
      orderId: order.id,
      type: 'payment_update',
      message: `PayPal informó el cobro ${capture.captureId ?? token} como ${capture.status}.`,
      actor: 'PayPal',
      payload: capture,
    });

    if (capture.status !== 'COMPLETED') {
      // PENDING: PayPal lo está revisando. Queda pendiente y se revisa a mano.
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: capture.status === 'PENDING' ? 'IN_PROCESS' : 'REJECTED',
          paypalCaptureId: capture.captureId,
        },
      });
      return NextResponse.redirect(result);
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paypalCaptureId: capture.captureId,
        chargedCurrency: capture.currency ?? order.chargedCurrency,
        chargedCents: capture.cents ?? order.chargedCents,
      },
    });
    const changed = await changeOrderStatus({ orderId: order.id, status: 'PAID', actor: 'PayPal' });
    if (changed.ok) {
      const payload = await orderMailPayload(order.id);
      if (payload) await sendAdminNewOrder(payload).catch(() => {});
    }
    return NextResponse.redirect(result);
  } catch (error) {
    console.error('[paypal:retorno]', error);
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_error',
      message: 'No se pudo capturar el pago en PayPal.',
      actor: 'PayPal',
    });
    return NextResponse.redirect(`${result}&estado=paypal-error`);
  }
}
