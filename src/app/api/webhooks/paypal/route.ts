import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPaypalWebhook } from '@/lib/paypal';
import { settlePaypalOrder } from '@/lib/paypal-settle';
import { logOrderEvent } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PaypalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

/**
 * Webhook de PayPal: la red de seguridad del retorno.
 *
 * Si el comprador aprueba el pago y cierra el navegador antes de volver a la
 * tienda, el retorno nunca se ejecuta. PayPal igual avisa acá con
 * CHECKOUT.ORDER.APPROVED y se cobra con la misma lógica que el retorno,
 * reserva de stock incluida.
 *
 * A diferencia del de Mercado Pago, un error responde 500 a propósito: PayPal
 * reintenta, y cobrar una orden es idempotente.
 *
 * Se activa registrando https://<dominio>/api/webhooks/paypal en el panel de
 * desarrollador de PayPal y poniendo su ID en PAYPAL_WEBHOOK_ID.
 */
export async function POST(request: NextRequest) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return NextResponse.json({ received: true, ignored: 'sin PAYPAL_WEBHOOK_ID' }, { status: 200 });
  }

  let event: PaypalWebhookEvent;
  try {
    event = (await request.json()) as PaypalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'cuerpo inválido' }, { status: 400 });
  }

  const valid = await verifyPaypalWebhook(request.headers, event).catch((error) => {
    console.error('[paypal-webhook:verificacion]', error);
    return null;
  });
  if (valid === null) return NextResponse.json({ error: 'no se pudo verificar' }, { status: 500 });
  if (!valid) {
    console.warn('[paypal-webhook] firma inválida', event.id);
    return NextResponse.json({ error: 'firma inválida' }, { status: 400 });
  }

  const type = event.event_type ?? '';
  const paypalOrderId =
    type === 'CHECKOUT.ORDER.APPROVED'
      ? event.resource?.id
      : event.resource?.supplementary_data?.related_ids?.order_id;

  try {
    if (paypalOrderId && (type === 'CHECKOUT.ORDER.APPROVED' || type === 'PAYMENT.CAPTURE.COMPLETED')) {
      const { outcome } = await settlePaypalOrder(paypalOrderId, 'PayPal (webhook)');
      if (outcome === 'error') return NextResponse.json({ retry: true }, { status: 500 });
    } else if (paypalOrderId && type.startsWith('PAYMENT.CAPTURE.')) {
      // Rechazos, reversos y reembolsos quedan en el historial del pedido para
      // revisarlos a mano: un reembolso puede ser parcial y no se devuelve
      // stock solo por el aviso.
      const order = await prisma.order.findFirst({ where: { paypalOrderId } });
      if (order) {
        await logOrderEvent({
          orderId: order.id,
          type: 'payment_update',
          message: `PayPal avisó ${type} (${event.resource?.status ?? 'sin estado'}). Revisa el cobro en PayPal.`,
          actor: 'PayPal (webhook)',
          payload: { eventId: event.id, type, status: event.resource?.status },
        });
      }
    }
  } catch (error) {
    console.error('[paypal-webhook:error]', error);
    return NextResponse.json({ retry: true }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
