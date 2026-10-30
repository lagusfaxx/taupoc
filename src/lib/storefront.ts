/**
 * Las dos tiendas que sirve esta misma aplicación.
 *
 * CL es taupoc.cl, la de siempre. INTL es taupoc.lat, la tienda para el resto
 * de Latinoamérica: mismo catálogo, mismo inventario, mismo panel y mismos
 * pedidos; cambia lo que ve el cliente, la moneda, el pago y el envío.
 *
 * La tienda se decide por el dominio en el middleware, que la deja en la
 * cabecera x-store y reescribe las rutas de INTL bajo /intl. Este módulo no
 * usa nada del servidor para poder importarse desde el middleware.
 */

export type Storefront = 'CL' | 'INTL';

export const STORE_HEADER = 'x-store';

/** Segmento interno donde viven las páginas de taupoc.lat. No es una URL pública. */
export const INTL_PREFIX = '/intl';

const DEFAULT_INTL_HOSTS = 'taupoc.lat';

function intlHosts(): Set<string> {
  const list = process.env.STORE_INTL_HOSTS || DEFAULT_INTL_HOSTS;
  return new Set(
    list
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** "taupoc.lat:443" → INTL. Cualquier dominio que no sea de INTL es la tienda chilena. */
export function storeFromHost(host: string | null | undefined): Storefront {
  const name = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
  return intlHosts().has(name) ? 'INTL' : 'CL';
}

/**
 * URL pública de cada tienda, para canónicas, enlaces entre dominios y
 * retornos de pago. Sale de la configuración y nunca de la cabecera Host, que
 * la escribe quien hace la solicitud.
 */
export function storeSiteUrl(store: Storefront): string {
  const url =
    store === 'INTL'
      ? process.env.SITE_URL_INTL || 'https://taupoc.lat'
      : process.env.SITE_URL_CL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

/**
 * taupoc.lat se abre a los buscadores recién en el lanzamiento: hasta que
 * INTL_INDEXABLE sea "true" todas sus páginas van con noindex y su robots.txt
 * no deja pasar a nadie.
 */
export function intlIndexable(): boolean {
  return process.env.INTL_INDEXABLE === 'true';
}
