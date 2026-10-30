import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { siteUrl } from '@/lib/mercadopago';
import { logOrderEvent } from '@/lib/orders';
import { releaseOrderReservation } from '@/lib/reservations';
import { storeSiteUrl } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * El comprador canceló en PayPal. Se suelta la reserva de stock en el acto,
 * sin esperar a que venza, y se le muestra el resultado del pedido.
 *
 * Solo se suelta si el token que agrega PayPal corresponde al pedido: el
 * número de pedido solo no alcanza para liberar la reserva de otro.
 */
export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get('order');
  const token = request.nextUrl.searchParams.get('token');
  if (!number) return NextResponse.redirect(`${siteUrl()}/carrito`);

  const order = token
    ? await prisma.order.findFirst({ where: { number, paypalOrderId: token } })
    : null;
  if (order && order.paymentStatus !== 'APPROVED' && order.paymentStatus !== 'IN_PROCESS') {
    try {
      const released = await prisma.$transaction((tx) => releaseOrderReservation(tx, order.id));
      if (released) {
        await logOrderEvent({
          orderId: order.id,
          type: 'reservation_released',
          message: 'El cliente canceló el pago en PayPal: las tallas vuelven a estar disponibles.',
          actor: 'PayPal',
        });
      }
    } catch (error) {
      console.error('[paypal:cancelado]', error);
    }
  }

  const storefront =
    order?.storefront ??
    (await prisma.order.findUnique({ where: { number }, select: { storefront: true } }))?.storefront;
  const base = storefront === 'INTL' ? storeSiteUrl('INTL') : siteUrl();
  return NextResponse.redirect(`${base}/checkout/resultado?order=${encodeURIComponent(number)}&estado=paypal-cancelado`);
}
