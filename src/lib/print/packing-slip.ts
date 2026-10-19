import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Order, OrderItem } from '@prisma/client';
import { regionName } from '../chile';
import { formatCLP } from '../money';
import { getSettings } from '../settings';
import { formatDate } from '../utils';

/**
 * Packing slip en PDF, para el agente de impresión.
 *
 * Es el mismo documento que /admin/pedidos/<id>/packing, pero armado en el
 * servidor: esa página depende del navegador para imprimirse y el agente
 * necesita un archivo. Una página A4 por pedido (o más, si trae muchos
 * productos), todos en un solo PDF.
 *
 * Las fuentes estándar de PDF solo cubren Latin-1: tildes y eñes salen bien,
 * lo demás (emojis, comillas raras) se aproxima o se reemplaza.
 */

type OrderWithItems = Order & { items: OrderItem[] };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.38, 0.38, 0.38);
const LIGHT = rgb(0.8, 0.8, 0.8);

/** Caracteres de Windows-1252 fuera de Latin-1 que la fuente sí tiene. */
const CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

export function pdfSafe(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .replace(/\s/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/gu, (ch) => {
      if (CP1252.includes(ch)) return ch;
      if (ch === '\u2212') return '-';
      // Letras con otros acentos pierden el acento; emojis y símbolos se van.
      return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
    })
    .replace(/ {2,}/g, ' ')
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(text).split(/ {2,}|\n/)) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

class Writer {
  page!: PDFPage;
  y = 0;

  constructor(
    private doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {}

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  text(value: string, x: number, size: number, opts: { font?: PDFFont; color?: typeof BLACK; align?: 'left' | 'right' | 'center'; width?: number } = {}) {
    const font = opts.font ?? this.regular;
    const safe = pdfSafe(value);
    const w = font.widthOfTextAtSize(safe, size);
    const dx = opts.align === 'right' ? (opts.width ?? 0) - w : opts.align === 'center' ? ((opts.width ?? 0) - w) / 2 : 0;
    this.page.drawText(safe, { x: x + dx, y: this.y - size, size, font, color: opts.color ?? BLACK });
  }

  line(y: number, thickness = 1, color = BLACK) {
    this.page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness, color });
  }
}

const COLS = {
  product: MARGIN,
  sku: MARGIN + 215,
  size: MARGIN + 320,
  qty: MARGIN + 370,
  total: MARGIN + 415,
  check: A4[0] - MARGIN - 24,
};

function tableHeader(w: Writer) {
  w.line(w.y, 1.5);
  w.y -= 6;
  const h = 7.5;
  w.text('PRODUCTO', COLS.product, h, { font: w.bold });
  w.text('SKU', COLS.sku, h, { font: w.bold });
  w.text('TALLA', COLS.size, h, { font: w.bold, align: 'center', width: 40 });
  w.text('CANT.', COLS.qty, h, { font: w.bold, align: 'center', width: 36 });
  w.text('TOTAL', COLS.total, h, { font: w.bold, align: 'right', width: 60 });
  w.text('OK', COLS.check, h, { font: w.bold, align: 'center', width: 24 });
  w.y -= h + 6;
  w.line(w.y, 1.5);
}

function drawOrder(w: Writer, order: OrderWithItems, settings: Awaited<ReturnType<typeof getSettings>>) {
  const contentWidth = A4[0] - 2 * MARGIN;
  w.newPage();

  // Encabezado
  const top = w.y;
  w.text('TAUPOC', MARGIN, 22, { font: w.bold });
  w.y -= 26;
  w.text('C H I L E', MARGIN, 8, { font: w.bold, color: GREY });
  w.y -= 18;
  w.text(settings.addressLine, MARGIN, 9, { color: GREY });
  w.y -= 12;
  w.text([settings.contactEmail, settings.contactPhone].filter(Boolean).join(' · '), MARGIN, 9, { color: GREY });
  const leftBottom = w.y - 9;

  w.y = top;
  w.text('GUÍA DE EMPAQUE', MARGIN, 8, { font: w.bold, color: GREY, align: 'right', width: contentWidth });
  w.y -= 14;
  w.text(order.number, MARGIN, 26, { font: w.bold, align: 'right', width: contentWidth });
  w.y -= 32;
  w.text(formatDate(order.createdAt), MARGIN, 9, { align: 'right', width: contentWidth });

  w.y = Math.min(leftBottom, w.y - 9) - 12;
  w.line(w.y, 2);
  w.y -= 20;

  // Destinatario y envío
  const colTop = w.y;
  const half = contentWidth / 2;
  w.text('DESPACHAR A', MARGIN, 7.5, { font: w.bold, color: GREY });
  w.y -= 14;
  w.text([order.firstName, order.lastName].filter(Boolean).join(' '), MARGIN, 11, { font: w.bold });
  w.y -= 15;
  const address = order.isPickup
    ? [order.shippingLabel ?? 'Retiro', 'Coordinado directamente con el cliente.']
    : [
        [[order.street, order.streetNumber].filter(Boolean).join(' '), order.addressExtra].filter(Boolean).join(', '),
        `${order.commune ?? ''}, ${regionName(order.region)}`,
        order.postalCode ? `CP ${order.postalCode}` : '',
      ];
  for (const raw of address.filter(Boolean)) {
    for (const line of wrap(raw, w.regular, 10, half - 16)) {
      w.text(line, MARGIN, 10);
      w.y -= 13;
    }
  }
  w.y -= 6;
  for (const raw of [order.phone, order.email]) {
    if (!raw) continue;
    w.text(raw, MARGIN, 10);
    w.y -= 13;
  }
  const leftEnd = w.y;

  w.y = colTop;
  const x2 = MARGIN + half;
  w.text('ENVÍO', x2, 7.5, { font: w.bold, color: GREY });
  w.y -= 14;
  for (const line of wrap(order.shippingLabel ?? '—', w.bold, 11, half)) {
    w.text(line, x2, 11, { font: w.bold });
    w.y -= 15;
  }
  if (order.shippingCarrier) {
    w.text(order.shippingCarrier, x2, 10);
    w.y -= 18;
  }
  if (order.trackingNumber) w.text(order.trackingNumber, x2, 12, { font: w.bold });
  else w.text('Sin número de seguimiento aún', x2, 10, { color: GREY });
  w.y = Math.min(leftEnd, w.y - 16) - 10;

  // Productos
  tableHeader(w);
  for (const item of order.items) {
    const nameLines = wrap(item.productName, w.bold, 10, COLS.sku - COLS.product - 8);
    // Nombre (una o más líneas) + color + aire.
    const rowHeight = nameLines.length * 12 + 26;
    if (w.y - rowHeight < MARGIN + 60) {
      w.newPage();
      w.text(`${order.number} (continuación)`, MARGIN, 10, { font: w.bold });
      w.y -= 22;
      tableHeader(w);
    }
    w.y -= 7;
    const rowTop = w.y;
    nameLines.forEach((line, i) => {
      w.y = rowTop - i * 12;
      w.text(line, COLS.product, 10, { font: w.bold });
    });
    w.y = rowTop - nameLines.length * 12;
    w.text(item.colorName ?? '', COLS.product, 9, { color: GREY });
    w.y = rowTop;
    w.text(item.sku, COLS.sku, 8.5);
    w.text(item.size, COLS.size, 12, { font: w.bold, align: 'center', width: 40 });
    w.text(String(item.quantity), COLS.qty, 10, { font: w.bold, align: 'center', width: 36 });
    w.text(formatCLP(item.lineTotal), COLS.total, 10, { align: 'right', width: 60 });
    w.page.drawRectangle({ x: COLS.check + 6, y: rowTop - 12, width: 11, height: 11, borderColor: BLACK, borderWidth: 0.8 });
    w.y = rowTop - rowHeight + 7;
    w.line(w.y, 0.5, LIGHT);
  }

  // Totales
  if (w.y < MARGIN + 150) w.newPage();
  w.y -= 14;
  const labelX = A4[0] - MARGIN - 210;
  const totals: [string, string][] = [['Subtotal', formatCLP(order.subtotal)]];
  if (order.discountTotal > 0) totals.push([`Descuento ${order.couponCode ?? ''}`.trim(), `-${formatCLP(order.discountTotal)}`]);
  totals.push(['Despacho', order.shippingTotal > 0 ? formatCLP(order.shippingTotal) : 'Gratis']);
  for (const [label, value] of totals) {
    w.text(label, labelX, 10, { color: GREY });
    w.text(value, labelX, 10, { align: 'right', width: 210 });
    w.y -= 16;
  }
  w.page.drawLine({ start: { x: labelX, y: w.y }, end: { x: A4[0] - MARGIN, y: w.y }, thickness: 1.5, color: BLACK });
  w.y -= 8;
  w.text('TOTAL', labelX, 11, { font: w.bold });
  w.text(formatCLP(order.total), labelX - 4, 14, { font: w.bold, align: 'right', width: 214 });
  w.y -= 30;

  // Nota del cliente
  if (order.customerNote) {
    const lines = wrap(order.customerNote, w.regular, 10, contentWidth - 16);
    if (w.y - (lines.length * 13 + 20) < MARGIN + 70) w.newPage();
    const noteTop = w.y;
    w.text('NOTA DEL CLIENTE', MARGIN + 12, 7.5, { font: w.bold, color: GREY });
    w.y -= 14;
    for (const line of lines) {
      w.text(line, MARGIN + 12, 10);
      w.y -= 13;
    }
    w.page.drawRectangle({ x: MARGIN, y: w.y + 2, width: 3, height: noteTop - w.y - 2, color: BLACK });
    w.y -= 12;
  }

  // Pie: cuidado del traje
  const care =
    'Ponlo con las palmas abiertas, nunca con las uñas. Enjuágalo con agua fría después de cada uso ' +
    'y sécalo a la sombra, extendido. Cambio de talla sin costo dentro de 10 días, sin uso y con ' +
    `etiqueta: escríbenos a ${settings.contactEmail}.`;
  const careLines = wrap(care, w.regular, 8.5, contentWidth);
  // Va pegado al pie de la página; si no cabe, en una nueva.
  const footerHeight = 22 + careLines.length * 11;
  if (w.y - footerHeight < MARGIN) w.newPage();
  w.y = MARGIN + footerHeight;
  w.line(w.y, 0.5, LIGHT);
  w.y -= 10;
  w.text('Antes de nadar con tu traje nuevo', MARGIN, 8.5, { font: w.bold });
  w.y -= 12;
  for (const line of careLines) {
    w.text(line, MARGIN, 8.5, { color: GREY });
    w.y -= 11;
  }
}

/** Un PDF con el packing slip de cada pedido, en el orden recibido. */
export async function packingSlipsPdf(orders: OrderWithItems[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(orders.length === 1 ? `Packing slip ${orders[0]!.number}` : `Packing slips (${orders.length})`);
  doc.setProducer('TAUPOC Chile');
  const writer = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  const settings = await getSettings();
  for (const order of orders) drawOrder(writer, order, settings);
  return doc.save();
}
