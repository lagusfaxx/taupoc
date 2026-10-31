import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo';
import { colorPagePath, getLineComparison } from '@/lib/catalog';
import { LANDINGS } from '@/lib/landings';
import { getSettings } from '@/lib/settings';

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
    ...Object.values(LANDINGS).map((l) => ({
      url: absoluteUrl(l.path),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    // Las guías de envío al extranjero redirigen a taupoc.lat: no van acá.
  ];

  try {
    const [products, posts, settings, comparacion] = await Promise.all([
      prisma.product.findMany({
        where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
        select: {
          slug: true,
          updatedAt: true,
          colors: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { slug: true } },
        },
      }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
      getSettings(),
      getLineComparison(),
    ]);

    // Con la división activa lo que se indexa es la ficha de cada color; la
    // URL del modelo redirige a la primera y no entra al sitemap.
    const productRoutes: MetadataRoute.Sitemap = products.flatMap((p) =>
      settings.catalogSplitByColor && p.colors.length > 1
        ? p.colors.map((c) => ({
            url: absoluteUrl(colorPagePath(p.slug, c.slug)),
            lastModified: p.updatedAt,
            changeFrequency: 'daily' as const,
            priority: 0.95,
          }))
        : [
            {
              url: absoluteUrl(`/producto/${p.slug}`),
              lastModified: p.updatedAt,
              changeFrequency: 'daily' as const,
              priority: 0.95,
            },
          ],
    );

    return [
      ...staticRoutes,
      // Con una sola línea publicada /lineas redirige al catálogo: no se
      // ofrece a Google una URL que no tiene contenido propio.
      ...(comparacion.length >= 2
        ? [{ url: absoluteUrl('/lineas'), changeFrequency: 'monthly' as const, priority: 0.8 }]
        : []),
      ...productRoutes,
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
