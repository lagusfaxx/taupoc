'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { AdminState } from './products';

const schema = z.object({
  imageUrl: z.string().trim().min(1, 'Sube la imagen de escritorio.'),
  imageMobileUrl: z.string().trim().optional(),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(300).optional(),
  tone: z.enum(['DARK', 'LIGHT']),
  active: z.string().optional(),
});

/** Guarda el banner de la portada de taupoc.lat. Hay uno solo. */
export async function saveIntlBanner(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  const d = parsed.data;
  if (Boolean(d.ctaLabel) !== Boolean(d.ctaHref)) {
    return { ok: false, message: 'El botón necesita texto y enlace, o ninguno de los dos.' };
  }
  const data = {
    imageUrl: d.imageUrl,
    imageMobileUrl: d.imageMobileUrl || null,
    title: d.title ?? '',
    body: d.body || null,
    ctaLabel: d.ctaLabel || null,
    ctaHref: d.ctaHref || null,
    tone: d.tone,
    active: d.active === 'on',
  };
  const current = await prisma.intlBanner.findFirst({ orderBy: { position: 'asc' } });
  if (current) await prisma.intlBanner.update({ where: { id: current.id }, data });
  else await prisma.intlBanner.create({ data });
  revalidatePath('/admin/internacional/banner');
  return { ok: true, message: data.active ? 'Banner publicado en taupoc.lat.' : 'Banner guardado (oculto).' };
}
