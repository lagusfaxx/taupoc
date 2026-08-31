import 'server-only';
import { prisma } from './db';
import { getFeatured, getProductsByIds } from './catalog';
import type { ProductCardData } from '@/components/store/ProductCard';

/**
 * Composición del inicio.
 *
 * El orden y el contenido salen de la tabla HomeBlock, que edita el panel. Si
 * no hay ningún bloque activo se arma una portada por defecto con el catálogo,
 * para que la tienda nunca quede en blanco.
 */

export type HomeBlockData = Awaited<ReturnType<typeof getHomeBlocks>>[number];

export async function getHomeBlocks() {
  const blocks = await prisma.homeBlock.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    include: {
      items: {
        orderBy: { position: 'asc' },
        include: { product: { select: { id: true, status: true } } },
      },
    },
  });

  // Los productos de todas las franjas se piden en una sola consulta y después
  // se reparten, en lugar de una consulta por bloque.
  const productIds = [
    ...new Set(blocks.flatMap((block) => block.items.map((item) => item.productId).filter(Boolean))),
  ] as string[];
  const products = await getProductsByIds(productIds);
  const byId = new Map(products.map((product) => [product.id, product]));

  return blocks.map((block) => ({
    ...block,
    products: block.items.flatMap((item) => {
      const product = item.productId ? byId.get(item.productId) : undefined;
      return product ? [product] : [];
    }),
    // Las mismas filas sirven de tarjeta en un bloque de accesos y de lámina
    // en un banner con varias; cambia qué campos usa cada uno al mostrarlas.
    cards: block.items
      .filter((item) => !item.productId)
      .map((item) => ({
        id: item.id,
        eyebrow: item.eyebrow ?? '',
        label: item.label ?? '',
        caption: item.caption ?? '',
        ctaLabel: item.ctaLabel ?? '',
        href: item.href ?? '',
        imageUrl: item.imageUrl,
        videoUrl: item.videoUrl,
        posterUrl: item.posterUrl,
      })),
  }));
}

/**
 * Una franja de productos siempre tiene qué mostrar: sin selección manual cae
 * en los destacados del catálogo.
 */
export async function fillProducts(
  block: { products: ProductCardData[]; columns: number },
): Promise<ProductCardData[]> {
  if (block.products.length > 0) return block.products;
  return getFeatured(Math.max(2, Math.min(8, block.columns)));
}
