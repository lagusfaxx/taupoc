import 'server-only';

/**
 * Tipo real de un archivo, leído de sus primeros bytes.
 *
 * Lo que declara el navegador no sirve para decidir: manda `image/jpg` en vez
 * de `image/jpeg` según el sistema, cadena vacía cuando no reconoce la
 * extensión, y `application/octet-stream` para una foto de iPhone. Rechazar
 * por ese dato deja fuera archivos perfectamente válidos, y el usuario ve un
 * "formato no admitido" sobre un JPG normal.
 *
 * Los bytes no mienten: cada formato empieza por una marca fija.
 */

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (bytes.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.toString('latin1', 0, 2) === 'BM') return 'image/bmp';
  if (bytes.toString('latin1', 4, 8) === 'ftyp') {
    const brand = bytes.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (HEIF_BRANDS.includes(brand)) return 'image/heic';
  }

  // Un SVG es texto: puede empezar por la declaración XML, un comentario o la
  // etiqueta misma, así que se busca dentro del principio del archivo.
  const inicio = bytes.toString('utf8', 0, 512).trim().toLowerCase();
  if (inicio.startsWith('<?xml') || inicio.startsWith('<svg') || inicio.startsWith('<!doctype svg')) {
    if (inicio.includes('<svg')) return 'image/svg+xml';
  }

  return null;
}

export function sniffVideoType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;

  // WEBM y MKV comparten el contenedor Matroska.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (bytes.toString('latin1', 4, 8) === 'ftyp') {
    const brand = bytes.toString('latin1', 8, 12);
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }

  return null;
}

/** Formatos que sharp lee pero los navegadores no muestran: hay que convertir. */
export const CONVERTIBLE_IMAGE_TYPES = ['image/heic', 'image/gif', 'image/bmp'];

/** Nombre legible, para poder explicar por qué un archivo no sirve. */
export const TYPE_NAMES: Record<string, string> = {
  'image/heic': 'HEIC (foto de iPhone)',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'video/quicktime': 'MOV (video de iPhone)',
};
