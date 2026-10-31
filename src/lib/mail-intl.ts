import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './db';
import { sendMail } from './mail';
import { getSettings } from './settings';
import { formatUsdCents } from './fx';
import { storeSiteUrl } from './storefront';

/*
 * Correos al cliente de taupoc.lat. Los de taupoc.cl (mail.ts) van en pesos,
 * con la marca chilena y en oscuro; estos van en dólares, con la marca
 * TAUPOC y en claro, como la tienda. Mismo transporte (Resend o SMTP).
 */

const INK = '#111214';
const SOFT = '#55585E';
const LINE = '#E6E6E3';
const ACCENT = '#1A3CFF';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY: Partial<Record<OrderStatus, { subject: (n: string) => string; title: string; text: string }>> = {
  PAID: {
    subject: (n) => `Recibimos tu pago · Pedido ${n}`,
    title: 'Pago confirmado',
    text: 'Gracias por tu compra. Preparamos tu pedido y te escribimos con el número de seguimiento apenas salga.',
  },
  PROCESSING: {
    subject: (n) => `Estamos preparando tu pedido ${n}`,
    title: 'Preparando tu pedido',
    text: 'Tu pedido está en preparación. Te avisamos cuando lo entreguemos a la paquetería.',
  },
  SHIPPED: {
    subject: (n) => `Tu pedido ${n} va en camino`,
    title: 'Tu pedido va en camino',
    text:
      'Lo entregamos a la paquetería. Con el número de seguimiento puedes ver dónde está. ' +
      'Recuerda que los impuestos de importación de tu país, si corresponden, se pagan al recibir.',
  },
  DELIVERED: {
    subject: (n) => `Tu pedido ${n} fue entregado`,
    title: 'Pedido entregado',
    text: 'La paquetería informa que tu pedido fue entregado. Que lo disfrutes en el agua.',
  },
  CANCELLED: {
    subject: (n) => `Pedido ${n} cancelado`,
    title: 'Pedido cancelado',
    text: 'Tu pedido fue cancelado. Si se te cobró, el reembolso se hace por PayPal al mismo medio de pago.',
  },
  REFUNDED: {
    subject: (n) => `Reembolso del pedido ${n}`,
    title: 'Reembolso realizado',
    text: 'Hicimos el reembolso por PayPal. Puede tardar unos días en verse en tu cuenta o tarjeta.',
  },
};

export function hasIntlStatusMail(status: OrderStatus): boolean {
  return Boolean(COPY[status]);
}

/** Aviso al cliente de un pedido de taupoc.lat cuando cambia su estado. */
export async function sendIntlOrderStatus(orderId: string, status: OrderStatus) {
  const copy = COPY[status];
  if (!copy) return { skipped: true as const };
  const settings = await getSettings();
  if (!settings.notifyOrderEmail) return { skipped: true as const };
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { skipped: true as const };

  const site = storeSiteUrl('INTL');
  const items = order.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:15px;color:${INK};">
          ${esc(i.productName)}<br><span style="color:${SOFT};">${esc(i.colorName)} · Talla ${esc(i.size)} · ${i.quantity} u.</span>
        </td>
      </tr>`,
    )
    .join('');
  const address = [
    [order.street, order.streetNumber].filter(Boolean).join(' '),
    order.addressExtra,
    [order.city, order.region, order.postalCode].filter(Boolean).join(', '),
    order.country,
  ]
    .filter(Boolean)
    .map(esc)
    .join('<br>');
  const tracking =
    status === 'SHIPPED' && order.trackingNumber
      ? `<p style="margin:24px 0 0;font-size:15px;color:${INK};">${esc(order.shippingCarrier)} · ${esc(order.trackingNumber)}</p>` +
        (order.trackingUrl
          ? `<p style="margin:16px 0 0;"><a href="${esc(order.trackingUrl)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:14px 24px;font-size:15px;">Seguir mi envío</a></p>`
          : '')
      : '';

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#fff;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(copy.text)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:Inter,Helvetica,Arial,sans-serif;">
        <tr><td style="font-size:18px;font-weight:600;letter-spacing:0.18em;color:${INK};padding-bottom:40px;">
          <a href="${site}" style="color:${INK};text-decoration:none;">TAUPOC</a>
        </td></tr>
        <tr><td>
          <p style="margin:0;font-size:13px;color:${SOFT};">Pedido ${esc(order.number)}</p>
          <h1 style="margin:8px 0 0;font-size:34px;line-height:1.05;letter-spacing:-0.03em;font-weight:600;color:${INK};">${esc(copy.title)}</h1>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.55;color:${SOFT};">${esc(copy.text)}</p>
          ${tracking}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid ${LINE};">${items}</table>
          ${
            order.chargedCents
              ? `<p style="margin:16px 0 0;font-size:17px;font-weight:600;color:${INK};">Total pagado: ${formatUsdCents(order.chargedCents)}</p>`
              : ''
          }
          <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${SOFT};">Envío a:<br>${address}</p>
          <p style="margin:40px 0 0;font-size:13px;line-height:1.55;color:${SOFT};">
            ¿Dudas? Responde este correo o escríbenos a ${esc(settings.contactEmail)}.<br>
            <a href="${site}" style="color:${ACCENT};">taupoc.lat</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendMail({ to: order.email, subject: copy.subject(order.number), html, replyTo: settings.contactEmail });
}
