import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/catalogo'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/guia-de-tallas'), changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/marca'), changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/clubes'), changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/blog'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/envios'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/devoluciones'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/contacto'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/terminos'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/privacidad'), changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const [products, posts] = await Promise.all([
      prisma.product.findMany({
        where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...products.map((p) => ({
        url: absoluteUrl(`/producto/${p.slug}`),
        lastModified: p.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.95,
      })),
      ...posts.map((p) => ({
        url: absoluteUrl(`/blog/${p.slug}`),
        lastModified: p.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // Durante el build la base puede no estar disponible todavía.
    return staticRoutes;
  }
}
