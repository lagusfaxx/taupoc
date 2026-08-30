'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { importMediaFromUrl, purgeOrphanMedia } from '@/lib/media';
import { isUsableMediaHref } from '@/lib/media-url';
import type { AdminState } from './products';
import type { BlockAlign, BlockHeight, HomeBlockType } from '@prisma/client';

function revalidateHome() {
  revalidatePath('/');
  revalidatePath('/admin/inicio');
}

const TYPES: HomeBlockType[] = ['BANNER', 'PRODUCTOS', 'CATEGORIAS', 'MEDIA', 'TEXTO'];

/** Punto de partida de cada tipo, para que el bloque nuevo ya se vea. */
const DEFAULTS: Record<HomeBlockType, { label: string; height: BlockHeight; columns: number }> = {
  BANNER: { label: 'Banner', height: 'MEDIA', columns: 4 },
  PRODUCTOS: { label: 'Franja de productos', height: 'AUTO', columns: 4 },
  CATEGORIAS: { label: 'Accesos', height: 'AUTO', columns: 4 },
  MEDIA: { label: 'Imagen o video', height: 'ALTA', columns: 4 },
  TEXTO: { label: 'Texto', height: 'AUTO', columns: 4 },
};

export async function createBlock(type: string): Promise<AdminState> {
  await requireAdmin();
  if (!TYPES.includes(type as HomeBlockType)) {
    return { ok: false, message: 'Tipo de bloque desconocido.' };
  }
  const kind = type as HomeBlockType;

  const last = await prisma.homeBlock.findFirst({
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const block = await prisma.homeBlock.create({
    data: {
      type: kind,
      position: (last?.position ?? 0) + 1,
      // Nace apagado: así se termina de armar sin que el visitante vea el
      // bloque a medio hacer.
      active: false,
      label: DEFAULTS[kind].label,
      height: DEFAULTS[kind].height,
      columns: DEFAULTS[kind].columns,
    },
    select: { id: true },
  });

  revalidateHome();
  return { ok: true, message: 'Bloque creado.', id: block.id };
}

const blockSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  ctaAltLabel: z.string().optional(),
  ctaAltHref: z.string().optional(),
  imageUrl: z.string().optional(),
  imageMobileUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  posterUrl: z.string().optional(),
  fit: z.string().optional(),
  overlay: z.string().optional(),
  height: z.string().optional(),
  align: z.string().optional(),
  background: z.string().optional(),
  columns: z.string().optional(),
  active: z.string().optional(),
});

const text = (value?: string) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Una dirección de medio que no se entiende se guarda como vacía. */
const mediaHref = (value?: string) => {
  const trimmed = (value ?? '').trim();
  return isUsableMediaHref(trimmed) ? trimmed : null;
};

export async function saveBlock(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: 'Revisa los datos del bloque.' };
  const d = parsed.data;

  const heights: BlockHeight[] = ['AUTO', 'COMPACTA', 'MEDIA', 'ALTA', 'PANTALLA'];
  const aligns: BlockAlign[] = ['IZQUIERDA', 'CENTRO', 'DERECHA'];

  await prisma.homeBlock.update({
    where: { id: d.id },
    data: {
      label: (d.label ?? '').trim().slice(0, 80),
      eyebrow: text(d.eyebrow),
      title: text(d.title),
      subtitle: text(d.subtitle),
      body: text(d.body),
      ctaLabel: text(d.ctaLabel),
      ctaHref: text(d.ctaHref),
      ctaAltLabel: text(d.ctaAltLabel),
      ctaAltHref: text(d.ctaAltHref),
      imageUrl: mediaHref(d.imageUrl),
      imageMobileUrl: mediaHref(d.imageMobileUrl),
      videoUrl: mediaHref(d.videoUrl),
      posterUrl: mediaHref(d.posterUrl),
      fit: d.fit === 'contain' ? 'contain' : 'cover',
      overlay: Math.min(90, Math.max(0, Number(d.overlay) || 0)),
      height: heights.includes(d.height as BlockHeight) ? (d.height as BlockHeight) : 'MEDIA',
      align: aligns.includes(d.align as BlockAlign) ? (d.align as BlockAlign) : 'IZQUIERDA',
      background: (d.background ?? 'ink').trim() || 'ink',
      columns: Math.min(5, Math.max(2, Number(d.columns) || 4)),
      active: d.active === 'on',
    },
  });

  // Los productos elegidos y las tarjetas sueltas viajan como listas propias.
  const productIds = formData.getAll('productId').map(String).filter(Boolean);
  const cardLabels = formData.getAll('cardLabel').map(String);
  const cardCaptions = formData.getAll('cardCaption').map(String);
  const cardHrefs = formData.getAll('cardHref').map(String);
  const cardImages = formData.getAll('cardImage').map(String);

  const items = [
    ...productIds.map((productId, index) => ({ productId, position: index })),
    ...cardLabels.flatMap((label, index) => {
      const clean = label.trim();
      if (!clean) return [];
      return [
        {
          position: productIds.length + index,
          label: clean.slice(0, 80),
          caption: text(cardCaptions[index]),
          href: text(cardHrefs[index]),
          imageUrl: mediaHref(cardImages[index]),
        },
      ];
    }),
  ];

  // Se reemplaza la lista entera: reconciliar fila a fila no aporta nada aquí
  // y deja casos raros cuando se reordena y se borra en la misma pasada.
  await prisma.$transaction([
    prisma.homeBlockItem.deleteMany({ where: { blockId: d.id } }),
    ...(items.length > 0
      ? [prisma.homeBlockItem.createMany({ data: items.map((item) => ({ ...item, blockId: d.id })) })]
      : []),
  ]);

  revalidateHome();
  return { ok: true, message: 'Bloque guardado.', id: d.id };
}

export async function toggleBlock(id: string, active: boolean) {
  await requireAdmin();
  await prisma.homeBlock.update({ where: { id }, data: { active } });
  revalidateHome();
}

export async function deleteBlock(id: string) {
  await requireAdmin();
  await prisma.homeBlock.delete({ where: { id } });
  revalidateHome();
}

export async function duplicateBlock(id: string): Promise<AdminState> {
  await requireAdmin();
  const source = await prisma.homeBlock.findUnique({ where: { id }, include: { items: true } });
  if (!source) return { ok: false, message: 'El bloque ya no existe.' };

  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, items, ...rest } = source;

  const copy = await prisma.homeBlock.create({
    data: {
      ...rest,
      label: `${rest.label || 'Bloque'} (copia)`,
      position: rest.position + 1,
      active: false,
      items: {
        create: items.map(({ id: _itemId, blockId: _blockId, ...item }) => item),
      },
    },
    select: { id: true },
  });

  revalidateHome();
  return { ok: true, message: 'Bloque duplicado.', id: copy.id };
}

/**
 * Mueve un bloque una posición.
 *
 * Se reordena la lista completa y se renumera de cero, en lugar de tocar solo
 * las dos filas: así el orden queda sin huecos ni empates aunque las
 * posiciones vinieran desalineadas de un borrado anterior.
 */
export async function moveBlock(id: string, direction: 'arriba' | 'abajo') {
  await requireAdmin();

  const blocks = await prisma.homeBlock.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return;

  const target = direction === 'arriba' ? index - 1 : index + 1;
  if (target < 0 || target >= blocks.length) return;

  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];

  await prisma.$transaction(
    blocks.map((block, position) =>
      prisma.homeBlock.update({ where: { id: block.id }, data: { position } }),
    ),
  );

  revalidateHome();
}

/**
 * Crea los bloques equivalentes a la portada por defecto.
 *
 * Es el punto de partida para quien quiere mover lo que ya está en vez de
 * armar la portada desde cero. Solo funciona con la lista vacía: con bloques
 * ya creados, agregarlos otra vez duplicaría el inicio.
 */
export async function seedDefaultBlocks(): Promise<AdminState> {
  await requireAdmin();

  const existentes = await prisma.homeBlock.count();
  if (existentes > 0) {
    return { ok: false, message: 'Ya hay bloques creados. Borra los que no quieras y reordena.' };
  }

  const [lines, covers] = await Promise.all([
    prisma.productLine.findMany({
      where: { active: true, slug: { in: ['r-skin', 'vel-skin'] } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.productImage.findMany({
      where: {
        product: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
        color: { active: true },
        sortOrder: 0,
      },
      orderBy: [{ product: { sortOrder: 'asc' } }, { color: { sortOrder: 'asc' } }],
      select: {
        url: true,
        product: { select: { modelCode: true, gender: true, line: { select: { slug: true } } } },
        color: { select: { slug: true } },
      },
    }),
  ]);

  const pick = (
    modelCode: string,
    colorSlug: string,
    fallback: (cover: (typeof covers)[number]) => boolean,
  ) =>
    covers.find((c) => c.product.modelCode === modelCode && c.color?.slug === colorSlug)?.url ??
    covers.find(fallback)?.url ??
    null;

  const accesos = [
    { label: 'Hombre', href: '/catalogo?genero=MALE', imageUrl: pick('TS703', 'negro-9192', (c) => c.product.gender === 'MALE') },
    { label: 'Mujer', href: '/catalogo?genero=FEMALE', imageUrl: pick('TS704', 'rosado-30049', (c) => c.product.gender === 'FEMALE') },
    ...lines.map((line) => ({
      label: line.name,
      href: `/catalogo?linea=${line.slug}`,
      imageUrl:
        line.slug === 'r-skin'
          ? pick('TS703', 'azul-marino-60289', (c) => c.product.line?.slug === 'r-skin')
          : pick('TS706', 'purpura-50008', (c) => c.product.line?.slug === 'vel-skin'),
    })),
  ];

  await prisma.homeBlock.create({
    data: {
      type: 'PRODUCTOS',
      position: 0,
      label: 'Destacados',
      height: 'AUTO',
      columns: 4,
      ctaLabel: 'Ver catálogo',
      ctaHref: '/catalogo',
    },
  });

  await prisma.homeBlock.create({
    data: {
      type: 'CATEGORIAS',
      position: 1,
      label: 'Accesos',
      height: 'AUTO',
      columns: 4,
      items: {
        create: accesos.map((acceso, position) => ({
          position,
          label: acceso.label,
          href: acceso.href,
          imageUrl: acceso.imageUrl,
        })),
      },
    },
  });

  await prisma.homeBlock.create({
    data: {
      type: 'TEXTO',
      position: 2,
      label: 'Clubes',
      title: 'Clubes',
      body:
        'Precio por volumen desde 10 unidades, con asesoría de tallas para el plantel y entrega ' +
        'en la sede o en el torneo.',
      ctaLabel: 'Cotización para clubes',
      ctaHref: '/clubes',
      background: 'oscuro',
      height: 'AUTO',
    },
  });

  revalidateHome();
  return { ok: true, message: 'Se crearon los tres bloques de la portada actual.' };
}

/**
 * Trae una imagen o un video desde una dirección externa y lo guarda como si
 * se hubiera subido, para que quede optimizado y no dependa de que ese
 * servidor siga en pie.
 */
export async function importMedia(url: string, kind: 'image' | 'video'): Promise<AdminState> {
  await requireAdmin();
  const result = await importMediaFromUrl(url, kind);
  if ('error' in result) return { ok: false, message: result.error };
  return { ok: true, message: result.warning ?? 'Archivo importado.', id: result.url };
}

/** Borra los archivos que ya no usa ninguna fila. */
export async function cleanUpMedia(): Promise<AdminState> {
  await requireAdmin();
  const removed = await purgeOrphanMedia();
  return {
    ok: true,
    message:
      removed === 0
        ? 'No había archivos sin usar.'
        : `Se borraron ${removed} archivo${removed === 1 ? '' : 's'} sin usar.`,
  };
}
