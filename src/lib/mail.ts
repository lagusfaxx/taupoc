import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { formatCLP } from './money';
import { getSettings } from './settings';

/**
 * Correo transaccional por SMTP. Si no hay SMTP configurado, los mensajes
 * se registran en consola en vez de fallar: la tienda nunca debe romperse
 * porque el correo esté caído.
 */

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || 'TAUPOC Chile <no-reply@taupoc.cl>';
  if (!transport) {
    console.info(`[mail:no-smtp] → ${opts.to} · ${opts.subject}`);
    return { skipped: true as const };
  }
  try {
    await transport.sendMail({ from, ...opts });
    return { skipped: false as const };
  } catch (error) {
    console.error('[mail:error]', error);
    return { skipped: true as const, error };
  }
}

// ── Plantillas ────────────────────────────────────────────────

const BRAND_BG = '#07090B';
const ACCENT = '#00E0B8';

function layout(title: string, body: string, siteUrl: string) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:'Helvetica Neue',Arial,sans-serif;color:#F4F6F8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0F1216;border:1px solid #232A33;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #232A33;">
          <div style="font-size:22px;font-weight:800;letter-spacing:.22em;color:#fff;">TAUPOC</div>
          <div style="font-size:11px;letter-spacing:.24em;color:${ACCENT};margin-top:6px;text-transform:uppercase;">Chile · Distribuidor oficial</div>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.65;color:#C9D1DA;">${body}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #232A33;font-size:12px;color:#7C8795;">
          <a href="${siteUrl}" style="color:${ACCENT};text-decoration:none;">taupoc.cl</a>
          &nbsp;·&nbsp; Trajes de competición homologados World Aquatics
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function itemsTable(items: { productName: string; colorName: string; size: string; quantity: number; lineTotal: number }[]) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #1A2027;">
          <div style="color:#F4F6F8;font-weight:600;">${i.productName}</div>
          <div style="color:#7C8795;font-size:13px;">${i.colorName} · Talla ${i.size} · ${i.quantity} u.</div>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #1A2027;color:#F4F6F8;white-space:nowrap;">${formatCLP(i.lineTotal)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows}</table>`;
}

function totals(o: { subtotal: number; discountTotal: number; shippingTotal: number; total: number }) {
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:${strong ? '#F4F6F8' : '#7C8795'};font-weight:${strong ? 700 : 400};">${label}</td>
     <td align="right" style="padding:4px 0;color:${strong ? ACCENT : '#C9D1DA'};font-weight:${strong ? 700 : 400};font-size:${strong ? '18px' : '14px'};">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    ${line('Subtotal', formatCLP(o.subtotal))}
    ${o.discountTotal > 0 ? line('Descuento', `-${formatCLP(o.discountTotal)}`) : ''}
    ${line('Despacho', o.shippingTotal > 0 ? formatCLP(o.shippingTotal) : 'Gratis')}
    ${line('Total', formatCLP(o.total), true)}
  </table>`;
}

export interface OrderMailData {
  number: string;
  email: string;
  firstName?: string | null;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  shippingLabel?: string | null;
  isPickup: boolean;
  street?: string | null;
  streetNumber?: string | null;
  commune?: string | null;
  region?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  items: { productName: string; colorName: string; size: string; quantity: number; lineTotal: number }[];
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#07090B;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px;padding:14px 26px;text-decoration:none;">${label}</a>`;
}

export async function sendOrderPlaced(order: OrderMailData) {
  const s = await getSettings();
  if (!s.notifyOrderEmail) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const html = layout(
    `Pedido ${order.number}`,
    `<p style="margin:0 0 6px;color:#fff;font-size:20px;font-weight:700;">Recibimos tu pedido ${order.number}</p>
     <p style="margin:0 0 18px;">Hola ${order.firstName ?? ''}, estamos esperando la confirmación del pago. Te avisamos apenas se acredite.</p>
     ${itemsTable(order.items)}
     ${totals(order)}
     <p style="margin:26px 0 0;">${button(`${site}/cuenta/pedidos`, 'Ver mi pedido')}</p>`,
    site,
  );
  await sendMail({ to: order.email, subject: `Pedido ${order.number} recibido · TAUPOC Chile`, html });
}

export async function sendOrderPaid(order: OrderMailData) {
  const s = await getSettings();
  if (!s.notifyOrderEmail) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const delivery = order.isPickup
    ? `<p style="margin:18px 0 0;color:#C9D1DA;"><strong style="color:#fff;">Retiro:</strong> ${order.shippingLabel ?? 'Retiro coordinado'}</p>`
    : `<p style="margin:18px 0 0;color:#C9D1DA;"><strong style="color:#fff;">Despacho a:</strong> ${[order.street, order.streetNumber].filter(Boolean).join(' ')}, ${order.commune ?? ''}</p>`;
  const html = layout(
    `Pago confirmado ${order.number}`,
    `<p style="margin:0 0 6px;color:${ACCENT};font-size:12px;letter-spacing:.22em;text-transform:uppercase;">Pago acreditado</p>
     <p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">Tu pedido ${order.number} está confirmado</p>
     <p style="margin:0 0 8px;">Ya estamos preparando tu envío. Te escribimos de nuevo cuando salga con el número de seguimiento.</p>
     ${itemsTable(order.items)}
     ${totals(order)}
     ${delivery}
     <p style="margin:26px 0 0;">${button(`${site}/cuenta/pedidos`, 'Seguir mi pedido')}</p>`,
    site,
  );
  await sendMail({ to: order.email, subject: `Pago confirmado · Pedido ${order.number}`, html });
}

export async function sendOrderShipped(order: OrderMailData) {
  const s = await getSettings();
  if (!s.notifyOrderEmail) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const tracking = order.trackingNumber
    ? `<div style="margin:18px 0;padding:16px;border:1px solid #232A33;background:#0B0E11;">
         <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7C8795;">Seguimiento ${order.carrier ?? ''}</div>
         <div style="font-family:monospace;font-size:18px;color:${ACCENT};margin-top:6px;">${order.trackingNumber}</div>
         ${order.trackingUrl ? `<div style="margin-top:12px;"><a href="${order.trackingUrl}" style="color:${ACCENT};font-size:13px;">Rastrear envío →</a></div>` : ''}
       </div>`
    : '';
  const html = layout(
    `Pedido ${order.number} despachado`,
    `<p style="margin:0 0 6px;color:${ACCENT};font-size:12px;letter-spacing:.22em;text-transform:uppercase;">En camino</p>
     <p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">Tu pedido ${order.number} salió a despacho</p>
     ${tracking}
     ${itemsTable(order.items)}
     <p style="margin:26px 0 0;">${button(`${site}/cuenta/pedidos`, 'Ver detalle')}</p>`,
    site,
  );
  await sendMail({ to: order.email, subject: `Pedido ${order.number} despachado · TAUPOC Chile`, html });
}

export async function sendAdminNewOrder(order: OrderMailData) {
  const s = await getSettings();
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to || !s.notifyAdminNewOrder) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const html = layout(
    `Nuevo pedido pagado ${order.number}`,
    `<p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">Pedido pagado: ${order.number}</p>
     <p style="margin:0;">Cliente: ${order.email}</p>
     ${itemsTable(order.items)}
     ${totals(order)}
     <p style="margin:26px 0 0;">${button(`${site}/admin/pedidos`, 'Abrir en el panel')}</p>`,
    site,
  );
  await sendMail({ to, subject: `[TAUPOC] Pedido pagado ${order.number} · ${formatCLP(order.total)}`, html });
}

export async function sendLowStockAlert(items: { sku: string; productName: string; colorName: string; size: string; stock: number }[]) {
  const s = await getSettings();
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to || !s.notifyLowStock || items.length === 0) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #1A2027;font-family:monospace;color:#C9D1DA;">${i.sku}</td>
        <td style="padding:8px 0;border-bottom:1px solid #1A2027;color:#C9D1DA;">${i.productName} · ${i.colorName} · T${i.size}</td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #1A2027;color:${i.stock === 0 ? '#F04B4B' : '#F0A93B'};font-weight:700;">${i.stock}</td>
      </tr>`,
    )
    .join('');
  const html = layout(
    'Alerta de stock bajo',
    `<p style="margin:0 0 6px;color:#F0A93B;font-size:12px;letter-spacing:.22em;text-transform:uppercase;">Inventario</p>
     <p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">${items.length} SKU bajo el umbral</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <p style="margin:26px 0 0;">${button(`${site}/admin/inventario`, 'Reponer stock')}</p>`,
    site,
  );
  await sendMail({ to, subject: `[TAUPOC] ${items.length} SKU con stock bajo`, html });
}

export async function sendQuoteRequestAlert(q: { clubName: string; contactName: string; email: string; phone: string; athletes?: number | null; message: string }) {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const html = layout(
    'Nueva cotización de club',
    `<p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">${q.clubName}</p>
     <p style="margin:0 0 4px;">Contacto: ${q.contactName}</p>
     <p style="margin:0 0 4px;">Email: ${q.email} · Teléfono: ${q.phone}</p>
     <p style="margin:0 0 16px;">Nadadores: ${q.athletes ?? '—'}</p>
     <p style="margin:0;padding:16px;border-left:2px solid ${ACCENT};background:#0B0E11;">${q.message.replace(/</g, '&lt;')}</p>
     <p style="margin:26px 0 0;">${button(`${site}/admin/cotizaciones`, 'Ver cotizaciones')}</p>`,
    site,
  );
  await sendMail({ to, subject: `[TAUPOC] Cotización de club · ${q.clubName}`, html });
}

export async function sendPasswordReset(email: string, resetUrl: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const html = layout(
    'Restablecer contraseña',
    `<p style="margin:0 0 18px;color:#fff;font-size:20px;font-weight:700;">Restablecer tu contraseña</p>
     <p style="margin:0 0 20px;">Recibimos una solicitud para cambiar tu contraseña. El enlace vence en 1 hora.</p>
     <p style="margin:0;">${button(resetUrl, 'Crear nueva contraseña')}</p>
     <p style="margin:20px 0 0;font-size:13px;color:#7C8795;">Si no fuiste tú, ignora este correo.</p>`,
    site,
  );
  await sendMail({ to: email, subject: 'Restablecer contraseña · TAUPOC Chile', html });
}
