import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { formatCLP } from './money';
import { getSettings } from './settings';
import { isMediaUrl } from './media-url';
import type { PlantillaDePrueba } from './mail-kinds';

/**
 * Correo transaccional. Se elige el transporte en este orden:
 *
 *   1. API de Resend, si hay RESEND_API_KEY. Va por HTTPS, así que no depende
 *      del puerto 587 saliente, que varios proveedores bloquean.
 *   2. SMTP, si hay SMTP_HOST. Sirve para Resend y para cualquier otro.
 *   3. Consola. Sin transporte configurado el mensaje se registra y la compra
 *      sigue su curso: el correo nunca debe bloquear una venta.
 */

export type MailTransport = 'resend' | 'smtp' | 'none';

export function mailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST) return 'smtp';
  return 'none';
}

function mailFrom(): string {
  return process.env.MAIL_FROM || 'TAUPOC Chile <no-reply@taupoc.cl>';
}

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

async function sendWithResend(opts: MailOptions): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    // El cuerpo de Resend explica el motivo: dominio sin verificar, clave
    // inválida, remitente no autorizado. Vale la pena registrarlo entero.
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend respondió ${response.status}: ${detail.slice(0, 300)}`);
  }
}

export async function sendMail(opts: MailOptions) {
  const transport = mailTransport();

  if (transport === 'none') {
    console.info(`[mail:sin-transporte] → ${opts.to} · ${opts.subject}`);
    return { skipped: true as const };
  }

  try {
    if (transport === 'resend') await sendWithResend(opts);
    else await smtpTransport().sendMail({ from: mailFrom(), ...opts });
    return { skipped: false as const };
  } catch (error) {
    console.error(`[mail:error:${transport}]`, error);
    return { skipped: true as const, error };
  }
}

// ── Plantillas ────────────────────────────────────────────────

/*
 * Paleta espejo de `tailwind.config.ts`. Va duplicada a propósito: el correo
 * se arma con estilos en línea porque los clientes ignoran las hojas de
 * estilo, así que no puede leer los tokens de Tailwind.
 */
const INK = '#07090B';
const INK_900 = '#0B0E11';
const INK_800 = '#11151A';
const LINE = '#232A33';
const LINE_SOFT = '#1A2027';
const CHALK = '#F4F6F8';
const CHALK_DIM = '#B9C1CB';
const CHALK_FAINT = '#7C8795';
const ACCENT = '#00E0B8';
const OK = '#22C58B';
const WARN = '#F0A93B';
const BAD = '#F04B4B';

/** Nada de lo que viene de la base entra crudo al HTML del correo. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Brand {
  siteUrl: string;
  storeName: string;
  logoUrl: string;
  logoHeight: number;
  logoHasName: boolean;
  contactEmail: string;
}

async function brand(): Promise<Brand> {
  const s = await getSettings();
  return {
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, ''),
    storeName: s.storeName || 'TAUPOC Chile',
    logoUrl: s.logoUrl,
    logoHeight: s.logoHeight,
    logoHasName: s.logoHasName,
    contactEmail: s.contactEmail,
  };
}

/** El correo viaja fuera del sitio: toda ruta interna necesita el dominio. */
function absolute(siteUrl: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Encabezado de marca.
 *
 * Si hay logo subido en el panel se usa ese; el texto alternativo repite el
 * nombre porque casi todos los clientes bloquean imágenes la primera vez, y
 * un encabezado vacío deja el correo sin identidad. Cuando el archivo ya
 * trae el nombre escrito (`logoHasName`) no se repite debajo.
 */
function logoBlock(b: Brand): string {
  if (b.logoUrl) {
    // Se pide al doble de alto para que no se vea borroso en pantallas retina.
    const src = absolute(b.siteUrl, isMediaUrl(b.logoUrl) ? `${b.logoUrl}?w=640` : b.logoUrl);
    const alto = Math.min(64, Math.max(18, b.logoHeight));
    return `<img src="${esc(src)}" alt="${esc(b.storeName)}" height="${alto}"
      style="display:block;border:0;outline:none;height:${alto}px;width:auto;max-width:100%;
             font-family:'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:800;
             letter-spacing:.2em;color:${CHALK};">
      ${b.logoHasName ? '' : `<div style="font-size:19px;font-weight:800;letter-spacing:.22em;color:${CHALK};margin-top:10px;">TAUPOC</div>`}`;
  }
  return `<div style="font-size:22px;font-weight:800;letter-spacing:.22em;color:${CHALK};">TAUPOC</div>`;
}

function layout(opts: { title: string; preheader: string; body: string; brand: Brand }): string {
  const { title, preheader, body, brand: b } = opts;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${CHALK};-webkit-font-smoothing:antialiased;">
  <!-- Texto de vista previa: es lo que la bandeja muestra junto al asunto. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};padding:32px 16px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${INK_900};border:1px solid ${LINE};">
        <!-- Filo de acento: la misma firma que corona el sitio. -->
        <tr><td style="height:3px;background:${ACCENT};line-height:3px;font-size:0;">&nbsp;</td></tr>

        <tr><td style="padding:30px 32px 26px;border-bottom:1px solid ${LINE};">
          ${logoBlock(b)}
          <div style="font-size:10px;letter-spacing:.24em;color:${ACCENT};margin-top:10px;text-transform:uppercase;">Chile · Distribuidor oficial</div>
        </td></tr>

        <tr><td style="padding:32px;font-size:15px;line-height:1.65;color:${CHALK_DIM};">${body}</td></tr>

        <tr><td style="padding:22px 32px;border-top:1px solid ${LINE};background:${INK};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-size:12px;color:${CHALK_FAINT};line-height:1.7;">
              <a href="${b.siteUrl}/catalogo" style="color:${CHALK_DIM};text-decoration:none;">Catálogo</a>
              <span style="color:${LINE_SOFT};"> · </span>
              <a href="${b.siteUrl}/cuenta/pedidos" style="color:${CHALK_DIM};text-decoration:none;">Mis pedidos</a>
              <span style="color:${LINE_SOFT};"> · </span>
              <a href="${b.siteUrl}/contacto" style="color:${CHALK_DIM};text-decoration:none;">Contacto</a>
              <div style="margin-top:10px;">Trajes de competición homologados World Aquatics.</div>
              ${b.contactEmail ? `<div style="margin-top:4px;">Dudas: <a href="mailto:${esc(b.contactEmail)}" style="color:${ACCENT};text-decoration:none;">${esc(b.contactEmail)}</a></div>` : ''}
            </td>
          </tr></table>
        </td></tr>
      </table>

      <div style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#5A6470;text-align:center;">
        Recibes este correo porque hiciste un pedido en
        <a href="${b.siteUrl}" style="color:#5A6470;">taupoc.cl</a>.
      </div>

    </td></tr>
  </table>
</body></html>`;
}

/** Antetítulo de color + titular. Abre todos los correos de pedido. */
function heading(eyebrow: string, color: string, title: string): string {
  return `<p style="margin:0 0 10px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${color};font-weight:700;">${esc(eyebrow)}</p>
    <p style="margin:0 0 16px;color:${CHALK};font-size:22px;line-height:1.25;font-weight:700;">${title}</p>`;
}

/** Recuadro para destacar un dato: seguimiento, dirección, motivo. */
function panel(label: string, inner: string, color = LINE): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr><td style="padding:16px 18px;background:${INK_800};border:1px solid ${color};">
      <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${CHALK_FAINT};">${esc(label)}</div>
      <div style="margin-top:8px;color:${CHALK_DIM};font-size:14px;line-height:1.6;">${inner}</div>
    </td></tr></table>`;
}

function itemsTable(items: { productName: string; colorName: string; size: string; quantity: number; lineTotal: number }[]) {
  const rows = items
    .map(
      (i) => `<tr>
        <td valign="top" style="padding:12px 0;border-bottom:1px solid ${LINE_SOFT};">
          <div style="color:${CHALK};font-weight:600;font-size:14.5px;">${esc(i.productName)}</div>
          <div style="color:${CHALK_FAINT};font-size:12.5px;margin-top:3px;">${esc(i.colorName)} · Talla ${esc(i.size)} · ${i.quantity} u.</div>
        </td>
        <td align="right" valign="top" style="padding:12px 0 12px 16px;border-bottom:1px solid ${LINE_SOFT};color:${CHALK};white-space:nowrap;font-size:14.5px;">${formatCLP(i.lineTotal)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
    <tr><td colspan="2" style="padding-bottom:10px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${CHALK_FAINT};border-bottom:1px solid ${LINE};">Tu pedido</td></tr>
    ${rows}
  </table>`;
}

function totals(o: { subtotal: number; discountTotal: number; shippingTotal: number; total: number }) {
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:${strong ? '12px 0 0' : '5px 0'};color:${strong ? CHALK : CHALK_FAINT};font-weight:${strong ? 700 : 400};font-size:${strong ? '15px' : '13.5px'};${strong ? `border-top:1px solid ${LINE};` : ''}">${label}</td>
     <td align="right" style="padding:${strong ? '12px 0 0' : '5px 0'};color:${strong ? ACCENT : CHALK_DIM};font-weight:${strong ? 700 : 400};font-size:${strong ? '20px' : '13.5px'};white-space:nowrap;${strong ? `border-top:1px solid ${LINE};` : ''}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
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

/**
 * Ajustes de un envío puntual.
 *
 * Existen para la prueba desde el panel: permite ver una plantilla sin
 * encender su bandera en Configuración y sin mandársela al cliente real.
 * En el flujo normal nadie los pasa y todo se comporta como siempre.
 */
export interface EnvioOpts {
  /** Ignora la bandera de Configuración que normalmente frena el envío. */
  force?: boolean;
  /** Reemplaza el destinatario que la plantilla elegiría. */
  to?: string;
}

/** Cómo llega el pedido: retiro coordinado o dirección de despacho. */
function deliveryBlock(order: OrderMailData): string {
  if (order.isPickup) {
    return panel('Retiro', esc(order.shippingLabel ?? 'Retiro coordinado en Santiago'));
  }
  const calle = [order.street, order.streetNumber].filter(Boolean).join(' ');
  const resto = [order.commune, order.region].filter(Boolean).join(', ');
  return panel('Despacho a', `${esc(calle)}${resto ? `<br>${esc(resto)}` : ''}${order.shippingLabel ? `<br><span style="color:${CHALK_FAINT};">${esc(order.shippingLabel)}</span>` : ''}`);
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr>
    <td style="background:${ACCENT};">
      <a href="${href}" style="display:inline-block;color:${INK};font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:12.5px;padding:15px 30px;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

/** Saludo con el nombre si lo tenemos; si no, algo que no suene a formulario. */
function hola(order: OrderMailData): string {
  return order.firstName ? `Hola ${esc(order.firstName)}, ` : '';
}

// ── Correos del ciclo del pedido ──────────────────────────────

export async function sendOrderPlaced(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Pedido ${order.number}`,
    preheader: `${hola(order)}recibimos tu pedido ${order.number}. Estamos esperando la confirmación del pago.`,
    brand: b,
    body:
      heading('Pedido recibido', ACCENT, `Recibimos tu pedido <span style="color:${ACCENT};">${esc(order.number)}</span>`) +
      `<p style="margin:0;">${hola(order)}estamos esperando la confirmación del pago. Te escribimos apenas se acredite.</p>` +
      itemsTable(order.items) +
      totals(order) +
      deliveryBlock(order) +
      button(`${b.siteUrl}/cuenta/pedidos`, 'Ver mi pedido'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pedido ${order.number} recibido · TAUPOC Chile`, html });
}

export async function sendOrderPaid(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Pago confirmado ${order.number}`,
    preheader: `Pago acreditado. Ya estamos preparando el pedido ${order.number}.`,
    brand: b,
    body:
      heading('Pago acreditado', OK, `Tu pedido <span style="color:${ACCENT};">${esc(order.number)}</span> está confirmado`) +
      `<p style="margin:0;">${hola(order)}ya estamos preparando tu envío. Te avisamos de nuevo cuando salga, con el número de seguimiento.</p>` +
      itemsTable(order.items) +
      totals(order) +
      deliveryBlock(order) +
      button(`${b.siteUrl}/cuenta/pedidos`, 'Seguir mi pedido'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pago confirmado · Pedido ${order.number}`, html });
}

export async function sendOrderProcessing(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Pedido ${order.number} en preparación`,
    preheader: `Estamos armando tu pedido ${order.number}. Sale a despacho apenas quede listo.`,
    brand: b,
    body:
      heading('En preparación', ACCENT, `Estamos armando tu pedido <span style="color:${ACCENT};">${esc(order.number)}</span>`) +
      `<p style="margin:0;">${hola(order)}tu pedido ya está en nuestro mesón: revisamos talla y colorway uno por uno antes de embalar. Apenas salga te enviamos el seguimiento.</p>` +
      itemsTable(order.items) +
      deliveryBlock(order) +
      `<p style="margin:22px 0 0;font-size:13.5px;color:${CHALK_FAINT};">¿Necesitas cambiar la talla o la dirección? Escríbenos ahora, mientras el pedido siga en preparación.</p>` +
      button(`${b.siteUrl}/cuenta/pedidos`, 'Ver mi pedido'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pedido ${order.number} en preparación · TAUPOC Chile`, html });
}

export async function sendOrderShipped(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const tracking = order.trackingNumber
    ? panel(
        `Seguimiento ${esc(order.carrier ?? '')}`.trim(),
        `<span style="font-family:'SF Mono',Consolas,monospace;font-size:19px;color:${ACCENT};letter-spacing:.06em;">${esc(order.trackingNumber)}</span>
         ${order.trackingUrl ? `<div style="margin-top:12px;"><a href="${esc(order.trackingUrl)}" style="color:${ACCENT};font-size:13px;text-decoration:none;font-weight:600;">Rastrear envío →</a></div>` : ''}`,
        ACCENT,
      )
    : '';
  const html = layout({
    title: `Pedido ${order.number} despachado`,
    preheader: `Tu pedido ${order.number} va en camino${order.trackingNumber ? ` · ${order.trackingNumber}` : ''}.`,
    brand: b,
    body:
      heading('En camino', ACCENT, `Tu pedido <span style="color:${ACCENT};">${esc(order.number)}</span> salió a despacho`) +
      `<p style="margin:0;">${hola(order)}tu pedido ya está en manos del transportista. El plazo va de 1 a 8 días hábiles según la región.</p>` +
      tracking +
      itemsTable(order.items) +
      deliveryBlock(order) +
      button(`${b.siteUrl}/cuenta/pedidos`, 'Ver detalle'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pedido ${order.number} despachado · TAUPOC Chile`, html });
}

export async function sendOrderDelivered(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Pedido ${order.number} entregado`,
    preheader: `Tu pedido ${order.number} fue entregado. Cuidado del traje y cambios de talla acá.`,
    brand: b,
    body:
      heading('Entregado', OK, `Tu pedido <span style="color:${ACCENT};">${esc(order.number)}</span> llegó`) +
      `<p style="margin:0 0 4px;">${hola(order)}esperamos que te quede perfecto. Dos cosas que alargan la vida del traje:</p>` +
      `<ul style="margin:12px 0 0;padding-left:20px;color:${CHALK_DIM};font-size:14px;line-height:1.7;">
         <li>Enjuágalo con agua fría apenas salgas del agua, sin retorcerlo.</li>
         <li>Sécalo a la sombra y en plano. Nunca en secadora ni al sol directo.</li>
       </ul>` +
      itemsTable(order.items) +
      `<p style="margin:22px 0 0;font-size:13.5px;color:${CHALK_FAINT};">¿La talla no calzó? Tienes 10 días para el cambio, con el traje sin uso y con etiqueta. <a href="${b.siteUrl}/devoluciones" style="color:${ACCENT};text-decoration:none;">Ver política de cambios</a></p>` +
      button(`${b.siteUrl}/catalogo`, 'Ver el catálogo'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pedido ${order.number} entregado · TAUPOC Chile`, html });
}

export async function sendOrderCancelled(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Pedido ${order.number} cancelado`,
    preheader: `Cancelamos tu pedido ${order.number}. Si alcanzaste a pagar, el reembolso va en camino.`,
    brand: b,
    body:
      heading('Cancelado', BAD, `Tu pedido <span style="color:${CHALK};">${esc(order.number)}</span> fue cancelado`) +
      `<p style="margin:0;">${hola(order)}dimos de baja este pedido y devolvimos las unidades al inventario.</p>` +
      panel(
        'Sobre tu dinero',
        `Si el pago alcanzó a acreditarse, el reembolso se hace por el mismo medio con que pagaste y lo verás reflejado en tu próximo estado de cuenta. Si el pago nunca se acreditó, no se te cobró nada.`,
        LINE,
      ) +
      itemsTable(order.items) +
      totals(order) +
      `<p style="margin:22px 0 0;font-size:13.5px;color:${CHALK_FAINT};">¿Fue un error o quieres retomarlo? Respóndenos este correo y lo vemos.</p>` +
      button(`${b.siteUrl}/contacto`, 'Escríbenos'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Pedido ${order.number} cancelado · TAUPOC Chile`, html });
}

export async function sendOrderRefunded(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  if (!opts?.force && !s.notifyOrderEmail) return;
  const b = await brand();
  const html = layout({
    title: `Reembolso del pedido ${order.number}`,
    preheader: `Emitimos el reembolso de ${formatCLP(order.total)} por tu pedido ${order.number}.`,
    brand: b,
    body:
      heading('Reembolsado', WARN, `Emitimos el reembolso de tu pedido <span style="color:${CHALK};">${esc(order.number)}</span>`) +
      `<p style="margin:0;">${hola(order)}ya devolvimos el pago por el mismo medio con que compraste.</p>` +
      panel(
        'Monto devuelto',
        `<span style="font-size:22px;font-weight:700;color:${ACCENT};">${formatCLP(order.total)}</span>
         <div style="margin-top:8px;color:${CHALK_FAINT};font-size:13px;">Según tu banco puede tardar entre 5 y 10 días hábiles en aparecer. Mercado Pago te envía su propio comprobante.</div>`,
        ACCENT,
      ) +
      itemsTable(order.items) +
      `<p style="margin:22px 0 0;font-size:13.5px;color:${CHALK_FAINT};">Si pasado ese plazo no lo ves reflejado, escríbenos con el número de pedido y lo revisamos contigo.</p>` +
      button(`${b.siteUrl}/contacto`, 'Escríbenos'),
  });
  await sendMail({ to: opts?.to ?? order.email, subject: `Reembolso emitido · Pedido ${order.number}`, html });
}

// ── Avisos internos ───────────────────────────────────────────

export async function sendAdminNewOrder(order: OrderMailData, opts?: EnvioOpts) {
  const s = await getSettings();
  const to = opts?.to ?? process.env.ADMIN_ALERT_EMAIL;
  if (!to || (!opts?.force && !s.notifyAdminNewOrder)) return;
  const b = await brand();
  const html = layout({
    title: `Nuevo pedido pagado ${order.number}`,
    preheader: `${order.number} · ${formatCLP(order.total)} · ${order.email}`,
    brand: b,
    body:
      heading('Nuevo pedido pagado', OK, `Pedido <span style="color:${ACCENT};">${esc(order.number)}</span>`) +
      panel('Cliente', esc(order.email)) +
      itemsTable(order.items) +
      totals(order) +
      deliveryBlock(order) +
      button(`${b.siteUrl}/admin/pedidos`, 'Abrir en el panel'),
  });
  await sendMail({ to, subject: `[TAUPOC] Pedido pagado ${order.number} · ${formatCLP(order.total)}`, html });
}

export async function sendLowStockAlert(
  items: { sku: string; productName: string; colorName: string; size: string; stock: number }[],
  opts?: EnvioOpts,
) {
  const s = await getSettings();
  const to = opts?.to ?? process.env.ADMIN_ALERT_EMAIL;
  if (!to || (!opts?.force && !s.notifyLowStock) || items.length === 0) return;
  const b = await brand();
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${LINE_SOFT};font-family:'SF Mono',Consolas,monospace;font-size:12.5px;color:${CHALK_DIM};">${esc(i.sku)}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${LINE_SOFT};color:${CHALK_DIM};font-size:13.5px;">${esc(i.productName)} · ${esc(i.colorName)} · T${esc(i.size)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid ${LINE_SOFT};color:${i.stock === 0 ? BAD : WARN};font-weight:700;">${i.stock}</td>
      </tr>`,
    )
    .join('');
  const html = layout({
    title: 'Alerta de stock bajo',
    preheader: `${items.length} SKU bajo el umbral de reposición.`,
    brand: b,
    body:
      heading('Inventario', WARN, `${items.length} SKU bajo el umbral`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">${rows}</table>` +
      button(`${b.siteUrl}/admin/inventario`, 'Reponer stock'),
  });
  await sendMail({ to, subject: `[TAUPOC] ${items.length} SKU con stock bajo`, html });
}

export async function sendQuoteRequestAlert(
  q: { clubName: string; contactName: string; email: string; phone: string; athletes?: number | null; message: string },
  opts?: EnvioOpts,
) {
  const to = opts?.to ?? process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const b = await brand();
  const html = layout({
    title: 'Nueva cotización de club',
    preheader: `${q.clubName} · ${q.athletes ?? '—'} nadadores`,
    brand: b,
    body:
      heading('Cotización de club', ACCENT, esc(q.clubName)) +
      panel(
        'Contacto',
        `${esc(q.contactName)}<br>
         <a href="mailto:${esc(q.email)}" style="color:${ACCENT};text-decoration:none;">${esc(q.email)}</a> · ${esc(q.phone)}<br>
         <span style="color:${CHALK_FAINT};">Nadadores: ${esc(q.athletes ?? '—')}</span>`,
      ) +
      `<div style="margin:20px 0 0;padding:16px 18px;border-left:2px solid ${ACCENT};background:${INK_800};color:${CHALK_DIM};font-size:14px;line-height:1.65;">${esc(q.message)}</div>` +
      button(`${b.siteUrl}/admin/cotizaciones`, 'Ver cotizaciones'),
  });
  await sendMail({ to, subject: `[TAUPOC] Cotización de club · ${q.clubName}`, html });
}

export async function sendPasswordReset(email: string, resetUrl: string) {
  const b = await brand();
  const html = layout({
    title: 'Restablecer contraseña',
    preheader: 'El enlace para crear tu nueva contraseña vence en 1 hora.',
    brand: b,
    body:
      heading('Tu cuenta', ACCENT, 'Restablecer tu contraseña') +
      `<p style="margin:0;">Recibimos una solicitud para cambiar tu contraseña. El enlace vence en 1 hora.</p>` +
      button(resetUrl, 'Crear nueva contraseña') +
      `<p style="margin:24px 0 0;font-size:13px;color:${CHALK_FAINT};">Si no fuiste tú, ignora este correo: tu contraseña actual sigue vigente.</p>`,
  });
  await sendMail({ to: email, subject: 'Restablecer contraseña · TAUPOC Chile', html });
}

// ── Envío de prueba desde el panel ────────────────────────────

/**
 * Pedido ficticio para ver una plantilla sin tener que comprar de verdad.
 *
 * Lleva dos líneas, descuento y despacho gratis a propósito: así se ven de
 * una vez todas las filas del bloque de totales, que con un pedido simple
 * quedarían ocultas.
 */
function pedidoDeMuestra(destino: string): OrderMailData {
  return {
    number: 'TP-PRUEBA',
    email: destino,
    firstName: 'Camila',
    subtotal: 189900,
    discountTotal: 19000,
    shippingTotal: 0,
    total: 170900,
    shippingLabel: 'Chilexpress Express · 1 a 3 días hábiles',
    isPickup: false,
    street: 'Av. Providencia',
    streetNumber: '1234',
    commune: 'Providencia',
    region: 'Metropolitana',
    carrier: 'Chilexpress',
    trackingNumber: '992847100238',
    trackingUrl: 'https://www.chilexpress.cl/seguimiento',
    items: [
      { productName: 'Knee Suit Vortex Pro', colorName: 'Negro / Aqua', size: '26', quantity: 1, lineTotal: 129900 },
      { productName: 'Gorra Silicona Race', colorName: 'Aqua', size: 'U', quantity: 2, lineTotal: 60000 },
    ],
  };
}


/**
 * Manda una plantilla a la dirección que se indique.
 *
 * Va con `force` para que se pueda revisar el diseño aunque la bandera de
 * Configuración esté apagada, y con `to` para que nunca salga al correo de
 * un cliente. Devuelve si el transporte llegó a intentarlo: sin proveedor
 * configurado `sendMail` no envía nada y conviene decirlo en pantalla.
 */
export async function sendTestMail(
  kind: PlantillaDePrueba,
  to: string,
): Promise<{ enviado: boolean }> {
  if (mailTransport() === 'none') return { enviado: false };

  const order = pedidoDeMuestra(to);
  const opts: EnvioOpts = { force: true, to };

  switch (kind) {
    case 'placed': await sendOrderPlaced(order, opts); break;
    case 'paid': await sendOrderPaid(order, opts); break;
    case 'processing': await sendOrderProcessing(order, opts); break;
    case 'shipped': await sendOrderShipped(order, opts); break;
    case 'delivered': await sendOrderDelivered(order, opts); break;
    case 'cancelled': await sendOrderCancelled(order, opts); break;
    case 'refunded': await sendOrderRefunded(order, opts); break;
    case 'admin': await sendAdminNewOrder(order, opts); break;
    case 'lowstock':
      await sendLowStockAlert(
        [
          { sku: 'VTX-26-NEG', productName: 'Knee Suit Vortex Pro', colorName: 'Negro / Aqua', size: '26', stock: 1 },
          { sku: 'VTX-28-NEG', productName: 'Knee Suit Vortex Pro', colorName: 'Negro / Aqua', size: '28', stock: 0 },
        ],
        opts,
      );
      break;
    case 'quote':
      await sendQuoteRequestAlert(
        {
          clubName: 'Club Natación Ejemplo',
          contactName: 'Camila Rojas',
          email: 'entrenador@ejemplo.cl',
          phone: '+56 9 1234 5678',
          athletes: 18,
          message: 'Necesitamos trajes para el equipo juvenil antes del nacional.',
        },
        opts,
      );
      break;
    case 'reset': {
      const b = await brand();
      await sendPasswordReset(to, `${b.siteUrl}/cuenta/restablecer?token=prueba`);
      break;
    }
  }

  return { enviado: true };
}
