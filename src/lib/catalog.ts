import 'server-only';
import { cache } from 'react';
import type { Gender, Prisma, ProductStatus } from '@prisma/client';
import { prisma } from './db';
import type { ProductCardData } from '@/components/store/ProductCard';

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Hombre',
  FEMALE: 'Mujer',
  UNISEX: 'Unisex',
};

const CARD_INCLUDE = {
  line: { select: { name: true, slug: true, accentHex: true, tier: true, tierLabel: true } },
  colors: {
    where: { active: true },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
      variants: { where: { active: true }, select: { stock: true, reserved: true, size: true } },
    },
  },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  // Solo el entero de cada reseña publicada: el promedio se calcula en
  // memoria. Con este catálogo sale más barato que un groupBy aparte, y
  // nunca se desincroniza como lo haría una columna denormalizada.
  reviews: { where: { status: 'PUBLISHED' as const }, select: { rating: true } },
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof CARD_INCLUDE }>;

/** Unidades que se pueden vender: lo reservado ya está comprometido. */
function disponibles(variant: { stock: number; reserved: number }): number {
  return Math.max(0, variant.stock - variant.reserved);
}

/**
 * Deja del producto solo los colores que tienen unidades en esas tallas.
 *
 * En la base cada producto tiene una fila por talla y color aunque esté en
 * cero: así funciona la matriz de inventario del panel. Por eso preguntar en
 * la consulta si "existe una variante de esa talla" da verdadero para todo el
 * catálogo y el filtro no filtra nada. Lo que decide es si esa talla tiene
 * unidades, y eso —`stock - reserved` sobre los colores publicados— se resuelve
 * acá, donde ya están cargadas, en vez de pedir otra consulta.
 *
 * Devuelve `null` cuando ningún color queda en pie: el producto no se ofrece
 * en esa talla y no entra en la grilla.
 */
function conTallaDisponible(
  product: ProductWithCard,
  sizes: string[] | null,
): ProductWithCard | null {
  const colors = product.colors.filter((color) =>
    color.variants.some(
      (v) => (sizes == null || sizes.includes(v.size)) && disponibles(v) > 0,
    ),
  );
  return colors.length > 0 ? { ...product, colors } : null;
}

export function toCardData(product: ProductWithCard): ProductCardData {
  const colors = product.colors.map((color) => ({
    id: color.id,
    name: color.name,
    code: color.code,
    slug: color.slug,
    hex: color.hex,
    imageUrl: color.images[0]?.url ?? null,
    stock: color.variants.reduce((s, v) => s + disponibles(v), 0),
  }));

  const allVariants = product.colors.flatMap((c) => c.variants);
  const totalStock = allVariants.reduce((s, v) => s + disponibles(v), 0);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    modelCode: product.modelCode,
    basePrice: product.basePrice,
    comingSoon: product.status === 'COMING_SOON',
    totalStock,
    colors,
    fallbackImage: product.images[0]?.url ?? colors.find((c) => c.imageUrl)?.imageUrl ?? null,
    accentHex: product.line?.accentHex ?? '#00E0B8',
    // Solo la línea superior se distingue en la grilla: si todas llevaran
    // sello, el sello dejaría de significar que una vale más que la otra.
    tierLabel: (product.line?.tier ?? 0) > 1 ? product.line?.tierLabel ?? null : null,
    tier: product.line?.tier ?? 0,
    rating: resumenDeNotas(product.reviews),
  };
}

/**
 * Una tarjeta por color en vez de una por modelo.
 *
 * El jammer con diez colorways ocupa diez lugares en la grilla y cada uno
 * lleva a la ficha de ese color, que es una página con URL, título, fotos y
 * stock propios. En la base sigue siendo un solo `Product` con sus colores:
 * el inventario y los pedidos no se parten, solo se separa lo que se publica.
 */
export function splitCardsByColor(cards: ProductCardData[]): ProductCardData[] {
  return cards.flatMap((card) =>
    card.colors.length <= 1
      ? [card]
      : card.colors.map((color) => ({
          ...card,
          id: `${card.id}:${color.slug}`,
          colorSlug: color.slug,
          fallbackImage: color.imageUrl ?? card.fallbackImage,
        })),
  );
}

/** Promedio y total de un puñado de notas ya filtradas a publicadas. */
export function resumenDeNotas(reviews: { rating: number }[]): { average: number; count: number } {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const suma = reviews.reduce((s, r) => s + r.rating, 0);
  // Un decimal: es lo que muestran las estrellas y lo que espera Google.
  return { average: Math.round((suma / reviews.length) * 10) / 10, count: reviews.length };
}

export interface CatalogFilters {
  gender?: Gender;
  lineSlug?: string;
  categorySlug?: string;
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  query?: string;
  sort?: 'destacados' | 'precio-asc' | 'precio-desc' | 'nuevos' | 'nombre';
}

const VISIBLE: ProductStatus[] = ['ACTIVE', 'COMING_SOON'];

/**
 * Una línea está a la vista solo si tiene algún producto a la vista.
 *
 * Así se apaga una línea entera desde el panel: pasar sus productos a
 * borrador saca también el acceso de la portada, el enlace del menú y del pie
 * y su columna del comparador. Sin esto la línea seguía anunciándose como
 * "próximamente" aunque no tuviera nada que vender.
 */
export const VISIBLE_LINE: Prisma.ProductLineWhereInput = {
  active: true,
  products: { some: { status: { in: VISIBLE } } },
};

function orderFor(sort: CatalogFilters['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'precio-asc':
      return [{ basePrice: 'asc' }, { name: 'asc' }];
    case 'precio-desc':
      return [{ basePrice: 'desc' }, { name: 'asc' }];
    case 'nuevos':
      return [{ createdAt: 'desc' }];
    case 'nombre':
      return [{ name: 'asc' }];
    default:
      return [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }];
  }
}

export async function getCatalog(filters: CatalogFilters = {}) {
  const where: Prisma.ProductWhereInput = {
    status: { in: VISIBLE },
    ...(filters.gender ? { gender: filters.gender } : {}),
    ...(filters.lineSlug ? { line: { slug: filters.lineSlug } } : {}),
    ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? {
          basePrice: {
            ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: 'insensitive' } },
            { modelCode: { contains: filters.query, mode: 'insensitive' } },
            { approvalCode: { contains: filters.query, mode: 'insensitive' } },
            { subtitle: { contains: filters.query, mode: 'insensitive' } },
            { description: { contains: filters.query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.colors?.length
      ? { colors: { some: { slug: { in: filters.colors }, active: true } } }
      : {}),
    // Prefiltro barato: descarta en la base lo que seguro no califica. La
    // condición exacta —unidades libres en un color publicado— se aplica
    // después sobre las variantes ya cargadas.
    ...(filters.sizes?.length
      ? { variants: { some: { size: { in: filters.sizes }, active: true, stock: { gt: 0 } } } }
      : filters.inStockOnly
        ? { variants: { some: { active: true, stock: { gt: 0 } } } }
        : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: CARD_INCLUDE,
    orderBy: orderFor(filters.sort),
  });

  // Filtrar por talla es preguntar por unidades en esa talla, no por que la
  // talla exista en la matriz. Se descartan los colores sin stock en ella
  // para que, con la grilla dividida por color, no aparezca una ficha que no
  // se puede comprar en lo que se pidió.
  const sizes = filters.sizes?.length ? filters.sizes : null;
  if (sizes == null && !filters.inStockOnly) return products.map(toCardData);

  return products.flatMap((product) => {
    const filtrado = conTallaDisponible(product, sizes);
    return filtrado ? [toCardData(filtrado)] : [];
  });
}

export async function getFeatured(limit = 4) {
  const products = await prisma.product.findMany({
    where: { status: { in: VISIBLE } },
    include: CARD_INCLUDE,
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });
  return products.map(toCardData);
}

/**
 * Productos elegidos a mano en el panel, en el orden en que se eligieron.
 * Los que estén ocultos o borrados simplemente no aparecen.
 */
export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: { in: VISIBLE } },
    include: CARD_INCLUDE,
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [toCardData(product)] : [];
  });
}

export interface LineComparisonColumn {
  slug: string;
  name: string;
  tier: number;
  tierLabel: string | null;
  accentHex: string;
  bestFor: string | null;
  /** Los datos que resumen la línea en una línea de texto. */
  claim: string | null;
  fromPrice: number | null;
  /** Ficha equivalente en esta línea, del mismo género que la que se mira. */
  productSlug: string | null;
  productName: string | null;
  comingSoon: boolean;
  metrics: { label: string; value: string; score: number; note: string | null }[];
}

/**
 * Las líneas de traje enfrentadas fila por fila, para la ficha.
 *
 * Sin esto, R-SKIN y VEL-SKIN se ven iguales y la única diferencia visible es
 * el precio. Se devuelven solo las líneas que tienen métricas cargadas y solo
 * si hay al menos dos: un comparador de una columna no compara nada.
 *
 * `gender` es el del producto que se está mirando, para que el enlace de la
 * otra línea lleve al modelo equivalente y no al del otro género. Sin género
 * —la página de líneas, que no mira ningún producto— manda el más barato.
 */
export const getLineComparison = cache(async function getLineComparison(
  gender?: Gender,
): Promise<LineComparisonColumn[]> {
  const lines = await prisma.productLine.findMany({
    where: { ...VISIBLE_LINE, metrics: { some: {} } },
    orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
    include: {
      metrics: { orderBy: { sortOrder: 'asc' } },
      products: {
        where: { status: { in: VISIBLE } },
        orderBy: [{ basePrice: 'asc' }],
        select: { slug: true, name: true, gender: true, basePrice: true, status: true },
      },
    },
  });

  if (lines.length < 2) return [];

  return lines.map((line) => {
    // Sin género —la página de líneas— vale cualquier modelo de la línea.
    const delGenero = gender ? line.products.filter((p) => p.gender === gender) : line.products;
    const referencia = delGenero[0] ?? line.products[0] ?? null;
    return {
      slug: line.slug,
      name: line.name,
      tier: line.tier,
      tierLabel: line.tierLabel,
      accentHex: line.accentHex,
      bestFor: line.bestFor,
      claim: line.cardClaim,
      // El "desde" se calcula sobre los modelos del mismo género: comparar el
      // jammer de una línea con el knee suit de la otra exagera la diferencia.
      fromPrice: (delGenero[0] ?? line.products[0])?.basePrice ?? null,
      productSlug: referencia?.slug ?? null,
      productName: referencia?.name ?? null,
      comingSoon: referencia?.status === 'COMING_SOON',
      metrics: line.metrics.map((m) => ({
        label: m.label,
        value: m.value,
        score: m.score,
        note: m.note,
      })),
    };
  });
});

/**
 * Decide si un enlace apunta a algo que la tienda no está mostrando: una
 * línea sin productos a la vista (`/catalogo?linea=vel-skin`) o la página de
 * líneas cuando no hay dos para comparar.
 *
 * Es para los enlaces que se escriben a mano en el panel —menú, accesos de la
 * portada—, que no se enteran solos de que una línea se apagó.
 */
export const getHiddenLinkFilter = cache(async function getHiddenLinkFilter() {
  const [hidden, comparison] = await Promise.all([
    prisma.productLine.findMany({ where: { NOT: VISIBLE_LINE }, select: { slug: true } }),
    getLineComparison(),
  ]);
  const hiddenSlugs = new Set(hidden.map((line) => line.slug));

  return function isHidden(href: string | null | undefined): boolean {
    if (!href) return false;
    let url: URL;
    try {
      url = new URL(href, 'http://tienda.local');
    } catch {
      return false;
    }
    if (url.pathname === '/lineas') return comparison.length < 2;
    const linea = url.searchParams.get('linea');
    return linea !== null && hiddenSlugs.has(linea);
  };
});

/**
 * Facetas para la barra de filtros, calculadas sobre el catálogo visible.
 *
 * `gender` es el del catálogo que se está mirando. Sin él, las tallas se
 * marcarían con el stock de todo el catálogo: la 22 agotada en jammers pero
 * disponible en knee suits se ofrecería en el filtro de hombre para devolver
 * cero resultados, que es justo lo que hace parecer que el filtro no sirve.
 */
export async function getCatalogFacets({ gender }: { gender?: Gender } = {}) {
  const forGender = gender ? { gender } : {};
  const [lines, categories, colors, variants, priceRange] = await Promise.all([
    prisma.productLine.findMany({
      where: { active: true, products: { some: { status: { in: VISIBLE } } } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.category.findMany({
      where: { active: true, products: { some: { status: { in: VISIBLE } } } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.productColor.findMany({
      where: { active: true, product: { status: { in: VISIBLE } } },
      select: { slug: true, name: true, hex: true },
    }),
    // Sin `groupBy`: lo que decide es `stock - reserved`, y eso no se puede
    // sumar en la base. Son unos cientos de filas de dos enteros.
    prisma.variant.findMany({
      where: {
        active: true,
        color: { active: true },
        product: { status: { in: VISIBLE }, ...forGender },
      },
      select: { size: true, stock: true, reserved: true },
    }),
    prisma.product.aggregate({
      where: { status: { in: VISIBLE } },
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
  ]);

  // Un mismo color existe en varios productos: se deduplica por slug.
  const colorMap = new Map<string, { slug: string; name: string; hex: string }>();
  for (const c of colors) if (!colorMap.has(c.slug)) colorMap.set(c.slug, c);

  const stockPorTalla = new Map<string, number>();
  for (const v of variants) {
    stockPorTalla.set(v.size, (stockPorTalla.get(v.size) ?? 0) + disponibles(v));
  }

  return {
    lines,
    categories,
    colors: [...colorMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    // Se informa qué tallas tienen unidades para poder deshabilitar el resto
    // en el filtro: una talla sin stock solo produce búsquedas vacías.
    sizes: [...stockPorTalla]
      .map(([size, unidades]) => ({ size, inStock: unidades > 0 }))
      .sort((a, b) => Number(a.size) - Number(b.size)),
    minPrice: priceRange._min.basePrice ?? 0,
    maxPrice: priceRange._max.basePrice ?? 0,
  };
}

/**
 * Producto completo para la ficha, con colores, tallas, imágenes y tabla de
 * tallas.
 *
 * Memorizado por solicitud: `generateMetadata` y la página piden el mismo
 * producto, y sin esto la consulta —la más pesada del sitio— se ejecutaba dos
 * veces antes de mostrar nada.
 */
export const getProductDetail = cache(async function getProductDetail(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: { in: VISIBLE } },
    include: {
      // Una fila de métricas basta: la ficha solo necesita saber si esta línea
      // entra o no en el comparador, no cuáles son sus datos.
      line: { include: { metrics: { take: 1, select: { id: true } } } },
      category: true,
      specs: { orderBy: { sortOrder: 'asc' } },
      sizeChart: { orderBy: { sortOrder: 'asc' } },
      colors: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
      images: { orderBy: { sortOrder: 'asc' } },
      reviews: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ publishedAt: 'desc' }],
      },
    },
  });
});

export async function getRelated(productId: string, lineId: string | null, limit = 4) {
  const products = await prisma.product.findMany({
    where: {
      status: { in: VISIBLE },
      id: { not: productId },
      ...(lineId ? { OR: [{ lineId }, { lineId: { not: lineId } }] } : {}),
    },
    include: CARD_INCLUDE,
    orderBy: [{ lineId: lineId ? 'asc' : 'desc' }, { featured: 'desc' }],
    take: limit,
  });
  return products.map(toCardData);
}

/** URL de la ficha de un color: `/producto/<modelo>-<color>`. */
export function colorPagePath(productSlug: string, colorSlug: string): string {
  return `/producto/${productSlug}-${colorSlug}`;
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export interface ResolvedProductRoute {
  product: ProductDetail;
  /** El color que nombra la URL. `null` en la ficha del modelo completo. */
  color: ProductDetail['colors'][number] | null;
}

/**
 * Resuelve `/producto/<slug>` aceptando además `<modelo>-<color>`.
 *
 * Cada colorway tiene su propia ficha, con su URL, su título, sus fotos y su
 * stock. Como el slug del color va pegado al del modelo con un guion y ambos
 * pueden llevar guiones, se prueban todos los cortes posibles empezando por
 * el modelo más largo: así un modelo llamado `ts703-azul` gana sobre el corte
 * `ts703` + color `azul`, que es lo que espera quien nombró el producto.
 */
export const resolveProductRoute = cache(async function resolveProductRoute(
  slug: string,
): Promise<ResolvedProductRoute | null> {
  const exact = await getProductDetail(slug);
  if (exact) return { product: exact, color: null };

  const parts = slug.split('-');
  const cortes: { productSlug: string; colorSlug: string }[] = [];
  for (let i = parts.length - 1; i >= 1; i--) {
    cortes.push({ productSlug: parts.slice(0, i).join('-'), colorSlug: parts.slice(i).join('-') });
  }
  if (cortes.length === 0) return null;

  const posibles = await prisma.product.findMany({
    where: { slug: { in: cortes.map((c) => c.productSlug) }, status: { in: VISIBLE } },
    select: { slug: true, colors: { where: { active: true }, select: { slug: true } } },
  });

  for (const corte of cortes) {
    const candidato = posibles.find((p) => p.slug === corte.productSlug);
    if (!candidato?.colors.some((c) => c.slug === corte.colorSlug)) continue;

    const product = await getProductDetail(corte.productSlug);
    const color = product?.colors.find((c) => c.slug === corte.colorSlug);
    if (product && color) return { product, color };
  }

  return null;
});
