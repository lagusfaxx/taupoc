'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { logOrderEvent } from '@/lib/orders';
import { findOrderByReviewToken } from '@/lib/review-requests';

export interface OrderReviewState {
  ok: boolean;
  message: string;
  /** Cuántas opiniones quedaron guardadas en este envío. */
  saved?: number;
}

const shared = z.object({
  token: z.string().min(16).max(64),
  authorName: z.string().trim().min(2, 'Ingresa tu nombre como quieres que aparezca.').max(80),
  authorNote: z.string().trim().max(120).optional(),
});

const perProduct = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
});

/**
 * Guarda las opiniones que el cliente deja desde el enlace del correo.
 *
 * El enlace prueba que compró: la opinión sale como compra verificada y
 * atada al pedido. Una por producto y pedido; si ya calificó un producto,
 * ese se salta. Según Configuración se publica al tiro o queda oculta
 * hasta que alguien la revise en la ficha del producto.
 */
export async function submitOrderReviews(
  _prev: OrderReviewState | null,
  formData: FormData,
): Promise<OrderReviewState> {
  // Campo trampa: los bots lo llenan, las personas no lo ven.
  if (formData.get('website')) return { ok: true, message: '¡Gracias por tu opinión!' };

  const base = shared.safeParse(Object.fromEntries(formData));
  if (!base.success) {
    return { ok: false, message: base.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const { token, authorName, authorNote } = base.data;

  if (!rateLimit(`order-review:${token}`, 10, 10 * 60_000)) {
    return { ok: false, message: 'Demasiados intentos seguidos. Espera unos minutos.' };
  }

  const order = await findOrderByReviewToken(token);
  if (!order) return { ok: false, message: 'El enlace ya no es válido.' };

  const yaCalificados = new Set(order.reviews.map((r) => r.productId));
  const productos = new Map<string, string>();
  for (const item of order.items) {
    if (item.product && !yaCalificados.has(item.product.id)) productos.set(item.product.id, item.product.slug);
  }

  const nuevas: { productId: string; rating: number; title: string | null; body: string }[] = [];
  for (const productId of productos.keys()) {
    const rating = formData.get(`rating_${productId}`);
    if (!rating) continue;
    const parsed = perProduct.safeParse({
      rating,
      title: formData.get(`title_${productId}`) ?? undefined,
      body: formData.get(`body_${productId}`) ?? undefined,
    });
    if (!parsed.success) return { ok: false, message: 'La nota va de 1 a 5 estrellas.' };
    nuevas.push({
      productId,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body ?? '',
    });
  }

  if (nuevas.length === 0) {
    return { ok: false, message: 'Marca las estrellas de al menos un producto.' };
  }

  const settings = await getSettings();
  const status = settings.reviewAutoPublish ? 'PUBLISHED' : 'HIDDEN';

  // `skipDuplicates` cubre el doble clic: la clave única es pedido + producto.
  const { count } = await prisma.review.createMany({
    data: nuevas.map((r) => ({
      ...r,
      orderId: order.id,
      userId: order.userId,
      authorName,
      authorNote: authorNote || null,
      verified: true,
      status,
    })),
    skipDuplicates: true,
  });

  await logOrderEvent({
    orderId: order.id,
    type: 'review_received',
    message: `El cliente calificó ${count} ${count === 1 ? 'producto' : 'productos'} (${nuevas
      .map((r) => `${r.rating}★`)
      .join(', ')}).`,
    actor: 'cliente',
  });

  for (const r of nuevas) revalidatePath(`/admin/productos/${r.productId}`);
  if (status === 'PUBLISHED') {
    revalidatePath('/catalogo');
    revalidatePath('/');
    // Con fichas por color un producto tiene varias URL: se invalidan todas.
    revalidatePath('/producto/[slug]', 'page');
  }
  revalidatePath(`/calificar/${token}`);

  return {
    ok: true,
    saved: count,
    message: settings.reviewAutoPublish
      ? '¡Gracias! Tu opinión ya aparece en la tienda.'
      : '¡Gracias! Recibimos tu opinión y la publicaremos pronto.',
  };
}
