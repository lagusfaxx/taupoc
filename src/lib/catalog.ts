import 'server-only';
import type { Gender, Prisma, ProductStatus } from '@prisma/client';
import { prisma } from './db';
import type { ProductCardData } from '@/components/store/ProductCard';

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Hombre',
  FEMALE: 'Mujer',
  UNISEX: 'Unisex',
};

const CARD_INCLUDE = {
  line: { select: { name: true, slug: true, accentHex: true } },
  colors: {
    where: { active: true },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
      variants: { where: { active: true }, select: { stock: true, reserved: true, size: true } },
    },
  },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof CARD_INCLUDE }>;

export function toCardData(product: ProductWithCard): ProductCardData {
  const colors = product.colors.map((color) => ({
    id: color.id,
    name: color.name,
    code: color.code,
    slug: color.slug,
    hex: color.hex,
    imageUrl: color.images[0]?.url ?? null,
    stock: color.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0),
  }));

  const allVariants = product.colors.flatMap((c) => c.variants);
  const totalStock = allVariants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
  const sizes = new Set(allVariants.map((v) => v.size));
  const sizesInStock = new Set(
    allVariants.filter((v) => v.stock - v.reserved > 0).map((v) => v.size),
  );

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    modelCode: product.modelCode,
    subtitle: product.subtitle,
    lineName: product.line?.name ?? null,
    genderLabel: GENDER_LABEL[product.gender],
    approvalCode: product.approvalCode,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    comingSoon: product.status === 'COMING_SOON',
    totalStock,
    sizesInStock: sizesInStock.size,
    totalSizes: sizes.size,
    colors,
    fallbackImage: product.images[0]?.url ?? colors.find((c) => c.imageUrl)?.imageUrl ?? null,
    accentHex: product.line?.accentHex ?? '#00E0B8',
  };
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
    ...(filters.sizes?.length
      ? {
          variants: {
            some: {
              size: { in: filters.sizes },
              active: true,
              ...(filters.inStockOnly ? { stock: { gt: 0 } } : {}),
            },
          },
        }
      : {}),
    ...(filters.inStockOnly && !filters.sizes?.length
      ? { variants: { some: { stock: { gt: 0 }, active: true } } }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: CARD_INCLUDE,
    orderBy: orderFor(filters.sort),
  });

  return products.map(toCardData);
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

/** Facetas para la barra de filtros, calculadas sobre el catálogo visible. */
export async function getCatalogFacets() {
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
    prisma.variant.findMany({
      where: { active: true, product: { status: { in: VISIBLE } } },
      select: { size: true },
      distinct: ['size'],
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

  return {
    lines,
    categories,
    colors: [...colorMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    sizes: variants.map((v) => v.size).sort((a, b) => Number(a) - Number(b)),
    minPrice: priceRange._min.basePrice ?? 0,
    maxPrice: priceRange._max.basePrice ?? 0,
  };
}

/** Producto completo para la ficha, con colores, tallas, imágenes y tabla de tallas. */
export async function getProductDetail(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: { in: VISIBLE } },
    include: {
      line: true,
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
    },
  });
}

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
