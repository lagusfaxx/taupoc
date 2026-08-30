/**
 * Armado de URLs de medios. Vive aparte de `media.ts` porque eso es código de
 * servidor y esto lo usan también los componentes del navegador.
 */

/** Los anchos que sabe servir /api/media. */
export const MEDIA_WIDTHS = [320, 640, 960, 1280, 1920];

/** Solo lo subido al panel sabe servirse en varios anchos. */
export function isMediaUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^\/api\/media\/[A-Za-z0-9_-]+$/.test(url.trim());
}

/**
 * Lista de anchos para `srcset`. El navegador elige el que le conviene según
 * su pantalla, así que un teléfono no se baja la versión de 1920. Devuelve
 * `undefined` para cualquier URL externa, que se deja como está.
 */
export function mediaSrcSet(url: string | null | undefined): string | undefined {
  if (!isMediaUrl(url)) return undefined;
  return MEDIA_WIDTHS.map((width) => `${url}?w=${width} ${width}w`).join(', ');
}

/** Descarta lo que no es una dirección utilizable como origen de un medio. */
export function isUsableMediaHref(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  return value.startsWith('/') || /^https?:\/\//i.test(value);
}
