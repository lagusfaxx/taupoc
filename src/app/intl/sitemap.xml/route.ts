import { getIntlCards } from '@/lib/intl-catalog';
import { storeSiteUrl } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * Sitemap de taupoc.lat (el middleware lleva /sitemap.xml a esta ruta). Cada
 * página que también existe en taupoc.cl declara su par con hreflang, igual
 * que en el HTML.
 */
export async function GET() {
  const lat = storeSiteUrl('INTL');
  const cl = storeSiteUrl('CL');
  const cards = await getIntlCards().catch(() => []);
  const paths = ['/', '/catalogo', ...new Set(cards.map((c) => c.href))];
  const esc = (s: string) => s.replace(/&/g, '&amp;');
  const body = paths
    .map((p) =>
      [
        '  <url>',
        `    <loc>${esc(lat + p)}</loc>`,
        `    <xhtml:link rel="alternate" hreflang="es-419" href="${esc(lat + p)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="es-CL" href="${esc(cl + p)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(lat + p)}"/>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    body +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
