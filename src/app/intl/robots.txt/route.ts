import { intlIndexable, storeSiteUrl } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * robots.txt de taupoc.lat (el middleware lleva /robots.txt a esta ruta).
 * Hasta el lanzamiento no deja pasar a ningún buscador.
 */
export function GET() {
  const body = intlIndexable()
    ? [
        'User-Agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /checkout',
        'Disallow: /carrito',
        '',
        `Host: ${storeSiteUrl('INTL')}`,
        `Sitemap: ${storeSiteUrl('INTL')}/sitemap.xml`,
        '',
      ].join('\n')
    : ['User-Agent: *', 'Disallow: /', ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
