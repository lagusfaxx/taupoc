import 'server-only';
import type { Gender } from '@prisma/client';
import { prisma } from './db';
import { clpToIntlCents } from './fx';
import { getCurrentFx } from './fx-server';
import { colorPagePath, resolveProductRoute, type ProductDetail } from './catalog';

/*
 * Catálogo de taupoc.lat. Lee los mismos productos, colores y variantes que
 * taupoc.cl —el stock es uno solo— y cambia lo que se publica:
 *
 * - Precio en dólares calculado al vuelo desde el precio chileno.
 * - Solo fotografía real de producto. Las tarjetas de color de la carga
 *   inicial (/uploads/catalogo/…) son marcadores oscuros pensados para
 *   taupoc.cl; sobre fondo claro se ven como lo que son, así que acá no se
 *   usan. Un color sin foto real no se publica en esta tienda.
 */

const VISIBLE = ['ACTIVE', 'COMING_SOON'] as const;

export function isStudioImage(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.length > 0 && !url.startsWith('/uploads/catalogo/');
}

interface ImageLike {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/** Fotos reales en el orden del panel; las de baja resolución, al final. */
function studioImages<T extends ImageLike>(images: T[]): T[] {
  const real = images.filter((i) => isStudioImage(i.url));
  return [...real.filter((i) => !i.width || i.width >= 800), ...real.filter((i) => i.width && i.width < 800)];
}

export interface IntlCard {
  key: string;
  href: string;
  productName: string;
  colorName: string;
  gender: Gender;
  image: ImageLike;
  priceCents: number | null;
  available: boolean;
  comingSoon: boolean;
}

/** Una tarjeta por color con foto real, primero lo que se puede comprar. */
export async function getIntlCards(filters: { gender?: Gender } = {}): Promise<IntlCard[]> {
  const [products, fx] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: [...VISIBLE] }, ...(filters.gender ? { gender: filters.gender } : {}) },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        colors: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            variants: { where: { active: true }, select: { stock: true, reserved: true } },
          },
        },
      },
    }),
    getCurrentFx(),
  ]);

  const cards = products.flatMap((p) =>
    p.colors.flatMap((c) => {
      const image = studioImages(c.images)[0];
      if (!image) return [];
      return [
        {
          key: `${p.id}:${c.id}`,
          href: p.colors.length > 1 ? colorPagePath(p.slug, c.slug) : `/producto/${p.slug}`,
          productName: p.name,
          colorName: c.name,
          gender: p.gender,
          image,
          priceCents: fx ? clpToIntlCents(p.basePrice, fx) : null,
          available: p.status === 'ACTIVE' && c.variants.some((v) => v.stock - v.reserved > 0),
          comingSoon: p.status === 'COMING_SOON',
        },
      ];
    }),
  );
  // Orden estable: disponibles primero, y dentro de cada grupo el del panel.
  return [...cards.filter((c) => c.available), ...cards.filter((c) => !c.available)];
}

export interface IntlProductView {
  product: ProductDetail;
  color: ProductDetail['colors'][number];
  images: ImageLike[];
  priceCents: number | null;
  sizes: { variantId: string; size: string; available: number; priceCents: number | null }[];
  colors: { slug: string; name: string; hex: string; href: string; current: boolean; available: boolean }[];
}

/**
 * Ficha de un color. Acepta la URL del modelo (`/producto/<modelo>`) y la de
 * cada color (`/producto/<modelo>-<color>`); en la del modelo devuelve el
 * primer color con foto real, para que la página redirija a él.
 */
export async function getIntlProduct(
  slug: string,
): Promise<{ redirectTo: string } | IntlProductView | null> {
  const resolved = await resolveProductRoute(slug);
  if (!resolved) return null;
  const { product } = resolved;
  const publishable = product.colors.filter((c) => studioImages(c.images).length > 0);
  if (publishable.length === 0) return null;

  const color = resolved.color ?? publishable[0];
  if (!publishable.some((c) => c.id === color.id)) return null;
  if (!resolved.color && product.colors.length > 1) {
    return { redirectTo: colorPagePath(product.slug, color.slug) };
  }

  const fx = await getCurrentFx();
  const price = (clp: number) => (fx ? clpToIntlCents(clp, fx) : null);
  const canBuy = product.status === 'ACTIVE';

  return {
    product,
    color,
    images: studioImages(color.images),
    priceCents: price(product.basePrice),
    sizes: color.variants
      .filter((v) => v.active)
      .map((v) => ({
        variantId: v.id,
        size: v.size,
        available: canBuy ? Math.max(0, v.stock - v.reserved) : 0,
        priceCents: price(v.priceOverride ?? product.basePrice),
      })),
    colors: publishable.map((c) => ({
      slug: c.slug,
      name: c.name,
      hex: c.hex,
      href: product.colors.length > 1 ? colorPagePath(product.slug, c.slug) : `/producto/${product.slug}`,
      current: c.id === color.id,
      available: canBuy && c.variants.some((v) => v.active && v.stock - v.reserved > 0),
    })),
  };
}
