import 'server-only';
import crypto from 'node:crypto';
import { prisma } from './db';
import { getSettings } from './settings';
import { siteUrl } from './seo';
import { logOrderEvent } from './orders';
import { mailTransport, sendReviewRequest } from './mail';

/**
 * Correo automático que pide calificar los productos de un pedido.
 *
 * Sale una sola vez por pedido, unos días después de la entrega. La fecha
 * base es `deliveredAt`; si nadie marcó el pedido como entregado se usa el
 * despacho más `SHIPPED_EXTRA_DAYS`, que es lo que suele tardar en llegar.
 *
 * Solo se consideran pedidos dentro de una ventana de `WINDOW_DAYS`: así,
 * al encender la opción por primera vez no le llega el correo a todo el
 * historial de clientes, sino solo a las compras recientes.
 */

const SHIPPED_EXTRA_DAYS = 5;
const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Tope por corrida: el resto sale en la siguiente. */
const BATCH = 25;

export function reviewUrl(token: string): string {
  return `${siteUrl()}/calificar/${token}`;
}

function newToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

type Result = { ok: boolean; message: string };

/**
 * Envía el correo de un pedido.
 *
 * `force` lo reenvía aunque ya haya salido (botón del panel). Sin `force`,
 * el pedido se reclama con un `updateMany` condicionado para que dos
 * corridas simultáneas no lo manden dos veces.
 */
export async function sendReviewRequestForOrder(
  orderId: string,
  opts: { force?: boolean; actor?: string | null } = {},
): Promise<Result> {
  if (mailTransport() === 'none') {
    return { ok: false, message: 'No hay proveedor de correo configurado.' };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      email: true,
      firstName: true,
      status: true,
      reviewToken: true,
      reviewRequestedAt: true,
      items: { select: { productId: true, productName: true, colorName: true, size: true } },
    },
  });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
    return { ok: false, message: 'Solo se pide calificación a pedidos despachados o entregados.' };
  }

  // Un producto por fila aunque haya venido en dos tallas o colores.
  const vistos = new Set<string>();
  const products = order.items.flatMap((item) => {
    if (!item.productId || vistos.has(item.productId)) return [];
    vistos.add(item.productId);
    const detail = [item.colorName, item.size && item.size !== 'U' ? `Talla ${item.size}` : null]
      .filter(Boolean)
      .join(' · ');
    return [{ productId: item.productId, name: item.productName, detail: detail || null }];
  });
  if (products.length === 0) {
    return { ok: false, message: 'El pedido no tiene productos del catálogo para calificar.' };
  }

  const token = order.reviewToken ?? newToken();
  const previous = order.reviewRequestedAt;

  if (opts.force) {
    await prisma.order.update({
      where: { id: order.id },
      data: { reviewToken: token, reviewRequestedAt: new Date() },
    });
  } else {
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, reviewRequestedAt: null },
      data: { reviewToken: token, reviewRequestedAt: new Date() },
    });
    if (claimed.count === 0) return { ok: false, message: 'El correo ya se había enviado.' };
  }

  const result = await sendReviewRequest({
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    reviewUrl: reviewUrl(token),
    products,
  });

  if (!result || result.skipped) {
    // Se devuelve el pedido a la cola para reintentar en la próxima corrida.
    await prisma.order.update({ where: { id: order.id }, data: { reviewRequestedAt: previous } });
    return { ok: false, message: 'El proveedor de correo no aceptó el envío. Revisa el log.' };
  }

  await logOrderEvent({
    orderId: order.id,
    type: 'review_request',
    message: opts.force ? 'Correo para calificar los productos reenviado.' : 'Correo para calificar los productos enviado.',
    actor: opts.actor ?? null,
  });
  return { ok: true, message: `Correo para calificar enviado a ${order.email}.` };
}

/** Pedidos de taupoc.cl a los que ya les toca el correo y aún no lo reciben. */
export async function findDueReviewRequests(delayDays: number, limit = BATCH) {
  const now = Date.now();
  const deliveredCutoff = new Date(now - delayDays * DAY_MS);
  const deliveredOldest = new Date(now - (delayDays + WINDOW_DAYS) * DAY_MS);
  const shippedCutoff = new Date(deliveredCutoff.getTime() - SHIPPED_EXTRA_DAYS * DAY_MS);
  const shippedOldest = new Date(deliveredOldest.getTime() - SHIPPED_EXTRA_DAYS * DAY_MS);

  return prisma.order.findMany({
    where: {
      storefront: 'CL',
      reviewRequestedAt: null,
      status: { in: ['SHIPPED', 'DELIVERED'] },
      items: { some: { productId: { not: null } } },
      // Quien está devolviendo la prenda para que le reembolsen no es buen
      // destinatario de un "¿qué te pareció?".
      NOT: { orderReturn: { is: { kind: 'REFUND', status: { not: 'CANCELLED' } } } },
      OR: [
        { deliveredAt: { lte: deliveredCutoff, gte: deliveredOldest } },
        { deliveredAt: null, shippedAt: { lte: shippedCutoff, gte: shippedOldest } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/** Corrida programada: manda los correos pendientes si la opción está activa. */
export async function sendDueReviewRequests(): Promise<{ sent: number; failed: number; skipped?: string }> {
  const settings = await getSettings();
  if (!settings.reviewRequestEnabled) return { sent: 0, failed: 0, skipped: 'desactivado' };
  if (mailTransport() === 'none') return { sent: 0, failed: 0, skipped: 'sin proveedor de correo' };

  const due = await findDueReviewRequests(settings.reviewRequestDelayDays);
  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      const r = await sendReviewRequestForOrder(id);
      if (r.ok) sent++;
      else failed++;
    } catch (error) {
      failed++;
      console.error('[calificacion:error]', id, error);
    }
    // Respeta el límite habitual de dos solicitudes por segundo de Resend.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { sent, failed };
}

let lastRun = 0;
let running = false;

/**
 * Versión con freno para colgarla de la tarea que corre cada minuto: no
 * hace falta revisar los pedidos más de una vez cada 15 minutos.
 */
export async function maybeSendDueReviewRequests() {
  if (running || Date.now() - lastRun < 15 * 60_000) return null;
  running = true;
  lastRun = Date.now();
  try {
    return await sendDueReviewRequests();
  } catch (error) {
    console.error('[calificacion:error]', error);
    return null;
  } finally {
    running = false;
  }
}

/** Pedido y sus productos para la página pública de calificación. */
export async function findOrderByReviewToken(token: string) {
  if (!token || token.length < 16 || token.length > 64) return null;
  return prisma.order.findUnique({
    where: { reviewToken: token },
    select: {
      id: true,
      number: true,
      userId: true,
      firstName: true,
      lastName: true,
      status: true,
      items: {
        select: {
          productId: true,
          productName: true,
          colorName: true,
          size: true,
          imageUrl: true,
          product: { select: { id: true, slug: true, name: true } },
        },
      },
      reviews: { select: { productId: true, rating: true } },
    },
  });
}
