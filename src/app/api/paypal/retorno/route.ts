import { NextResponse, type NextRequest } from 'next/server';
import { siteUrl } from '@/lib/mercadopago';
import { settlePaypalOrder } from '@/lib/paypal-settle';

export const dynamic = 'force-dynamic';

/**
 * PayPal devuelve aquí al comprador con ?token=<id de la orden de PayPal>.
 * Se captura el cobro y, si quedó completado, el pedido pasa a pagado por el
 * mismo camino que una transferencia confirmada: stock, cupón y correos. Si
 * el comprador no vuelve, el webhook de PayPal hace lo mismo.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(`${siteUrl()}/carrito`);

  const { outcome, orderNumber } = await settlePaypalOrder(token, 'PayPal').catch((error) => {
    console.error('[paypal:retorno]', error);
    return { outcome: 'error' as const, orderNumber: null };
  });
  if (!orderNumber) return NextResponse.redirect(`${siteUrl()}/carrito`);

  const result = `${siteUrl()}/checkout/resultado?order=${orderNumber}`;
  if (outcome === 'out_of_stock') return NextResponse.redirect(`${result}&estado=agotado`);
  if (outcome === 'error') return NextResponse.redirect(`${result}&estado=paypal-error`);
  return NextResponse.redirect(result);
}
