'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminState } from './products';

function revalidarFicha(slug?: string) {
  revalidatePath('/catalogo');
  revalidatePath('/');
  if (slug) revalidatePath(`/producto/${slug}`);
}

const schema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1, 'La nota va de 1 a 5.').max(5, 'La nota va de 1 a 5.'),
  authorName: z.string().trim().min(2, 'Ingresa quién dejó la opinión.').max(80),
  authorNote: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
  verified: z.string().optional(),
  status: z.enum(['PUBLISHED', 'HIDDEN']).optional(),
  /** Fecha real de la opinión, en formato YYYY-MM-DD. */
  publishedAt: z.string().optional(),
});

/**
 * Crea o actualiza una opinión cargada a mano.
 *
 * Son reseñas que el cliente dejó por WhatsApp, Instagram o en el stand y que
 * acá quedan atribuidas al producto. Deben ser reales: el marcado que emite
 * la ficha las declara ante Google, y una nota inventada expone la tienda a
 * una sanción manual además de engañar a quien compra.
 */
export async function saveReview(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: d.productId },
    select: { slug: true },
  });
  if (!product) return { ok: false, message: 'Producto no encontrado.' };

  // Una fecha suelta se interpreta como mediodía UTC: así no se corre al día
  // anterior al mostrarla en Chile, que va detrás de UTC.
  const fecha = d.publishedAt ? new Date(`${d.publishedAt}T12:00:00.000Z`) : undefined;
  if (fecha && Number.isNaN(fecha.getTime())) {
    return { ok: false, message: 'La fecha no es válida.' };
  }

  const datos = {
    rating: d.rating,
    authorName: d.authorName,
    authorNote: d.authorNote || null,
    title: d.title || null,
    body: d.body ?? '',
    verified: d.verified === 'on',
    status: d.status ?? 'PUBLISHED',
    ...(fecha ? { publishedAt: fecha } : {}),
  };

  if (d.id) {
    await prisma.review.update({ where: { id: d.id }, data: datos });
  } else {
    await prisma.review.create({ data: { ...datos, productId: d.productId } });
  }

  revalidatePath(`/admin/productos/${d.productId}`);
  revalidarFicha(product.slug);
  return { ok: true, message: d.id ? 'Opinión actualizada.' : 'Opinión agregada.' };
}

export async function deleteReview(id: string) {
  await requireAdmin();
  const review = await prisma.review.findUnique({
    where: { id },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!review) return;

  await prisma.review.delete({ where: { id } });
  revalidatePath(`/admin/productos/${review.productId}`);
  revalidarFicha(review.product.slug);
}

/** Oculta o vuelve a publicar sin perder el texto. */
export async function toggleReviewStatus(id: string) {
  await requireAdmin();
  const review = await prisma.review.findUnique({
    where: { id },
    select: { status: true, productId: true, product: { select: { slug: true } } },
  });
  if (!review) return;

  await prisma.review.update({
    where: { id },
    data: { status: review.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED' },
  });
  revalidatePath(`/admin/productos/${review.productId}`);
  revalidarFicha(review.product.slug);
}
