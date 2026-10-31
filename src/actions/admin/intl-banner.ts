'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { AdminState } from './products';

const schema = z.object({
  id: z.string().optional(),
  imageUrl: z.string().trim().optional(),
  imageMobileUrl: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  videoMobileUrl: z.string().trim().optional(),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(300).optional(),
  tone: z.enum(['DARK', 'LIGHT']),
  titleSize: z.enum(['S', 'M', 'L']).default('M'),
  focalX: z.coerce.number().int().min(0).max(100).default(50),
  focalY: z.coerce.number().int().min(0).max(100).default(50),
  active: z.string().optional(),
});

function done() {
  revalidatePath('/admin/internacional/banner');
}

/** Guarda una diapositiva del banner de taupoc.lat. Sin id, crea una nueva al final. */
export async function saveIntlBanner(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  const d = parsed.data;
  if (!d.imageUrl && !d.imageMobileUrl && !d.videoUrl && !d.videoMobileUrl) {
    return { ok: false, message: 'Sube una imagen o un video.' };
  }
  if (Boolean(d.ctaLabel) !== Boolean(d.ctaHref)) {
    return { ok: false, message: 'El botón necesita texto y enlace, o ninguno de los dos.' };
  }
  const data = {
    imageUrl: d.imageUrl ?? '',
    imageMobileUrl: d.imageMobileUrl || null,
    videoUrl: d.videoUrl || null,
    videoMobileUrl: d.videoMobileUrl || null,
    title: d.title ?? '',
    body: d.body || null,
    ctaLabel: d.ctaLabel || null,
    ctaHref: d.ctaHref || null,
    tone: d.tone,
    titleSize: d.titleSize,
    focalX: d.focalX,
    focalY: d.focalY,
    active: d.active === 'on',
  };
  if (d.id) {
    await prisma.intlBanner.update({ where: { id: d.id }, data });
  } else {
    const last = await prisma.intlBanner.aggregate({ _max: { position: true } });
    await prisma.intlBanner.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
  }
  done();
  return { ok: true, message: data.active ? 'Banner publicado en taupoc.lat.' : 'Banner guardado (oculto).' };
}

export async function deleteIntlBanner(id: string): Promise<AdminState> {
  await requireAdmin();
  await prisma.intlBanner.delete({ where: { id } }).catch(() => null);
  done();
  return { ok: true, message: 'Banner eliminado.' };
}

/** Mueve una diapositiva un lugar antes (-1) o después (+1). */
export async function moveIntlBanner(id: string, dir: -1 | 1): Promise<AdminState> {
  await requireAdmin();
  const all = await prisma.intlBanner.findMany({ orderBy: { position: 'asc' }, select: { id: true } });
  const i = all.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return { ok: false, message: 'No se puede mover más.' };
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((b, position) => prisma.intlBanner.update({ where: { id: b.id }, data: { position } })));
  done();
  return { ok: true, message: 'Orden guardado.' };
}

/**
 * Reemplaza los banners de taupoc.lat por una copia del banner de la portada
 * de taupoc.cl: el primer bloque de banner activo, con todas sus
 * diapositivas. Comparten los mismos archivos de imagen y video; los textos
 * quedan editables por separado.
 */
export async function copyClBanners(): Promise<AdminState> {
  await requireAdmin();
  const block = await prisma.homeBlock.findFirst({
    where: { type: 'BANNER', active: true },
    orderBy: { position: 'asc' },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (!block) return { ok: false, message: 'taupoc.cl no tiene un banner activo en la portada.' };

  const sources = block.items.length
    ? block.items.map((i) => ({
        imageUrl: i.imageUrl ?? i.posterUrl ?? '',
        imageMobileUrl: i.imageMobileUrl,
        videoUrl: i.videoUrl,
        title: i.label ?? '',
        body: i.caption,
        ctaLabel: i.ctaLabel,
        ctaHref: i.href,
      }))
    : [
        {
          imageUrl: block.imageUrl ?? block.posterUrl ?? '',
          imageMobileUrl: block.imageMobileUrl,
          videoUrl: block.videoUrl,
          title: block.title ?? '',
          body: block.subtitle ?? block.body,
          ctaLabel: block.ctaLabel,
          ctaHref: block.ctaHref,
        },
      ];
  const slides = sources.filter((s) => s.imageUrl || s.imageMobileUrl || s.videoUrl);
  if (slides.length === 0) return { ok: false, message: 'El banner de taupoc.cl no tiene imágenes ni videos.' };

  await prisma.$transaction([
    prisma.intlBanner.deleteMany({}),
    ...slides.map((s, position) =>
      prisma.intlBanner.create({
        data: {
          position,
          active: true,
          imageUrl: s.imageUrl,
          imageMobileUrl: s.imageMobileUrl || null,
          videoUrl: s.videoUrl || null,
          title: s.title,
          body: s.body || null,
          ctaLabel: s.ctaLabel && s.ctaHref ? s.ctaLabel : null,
          ctaHref: s.ctaLabel && s.ctaHref ? s.ctaHref : null,
          // Los banners de taupoc.cl llevan texto claro sobre la foto.
          tone: 'LIGHT',
          titleSize: 'M',
        },
      }),
    ),
  ]);
  done();
  return {
    ok: true,
    message: `Copiamos ${slides.length} ${slides.length === 1 ? 'banner' : 'banners'} de taupoc.cl. Revisa los textos y el enfoque en teléfono.`,
  };
}
