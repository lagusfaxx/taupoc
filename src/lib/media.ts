import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { MEDIA_WIDTHS } from './media-url';

/**
 * Archivos subidos desde el panel.
 *
 * Se guardan en Postgres y no en disco: el contenedor se reemplaza en cada
 * despliegue, así que sin un volumen montado los archivos escritos en el
 * sistema de archivos desaparecen. En la base entran además en el respaldo.
 */

/**
 * Tope de una imagen. Si sube, hay que subir también
 * `serverActions.bodySizeLimit` en next.config.mjs para las que viajan por
 * Server Actions.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

/**
 * Tope de un video. No lo pone el servidor —se sirve por tramos acotados— sino
 * el visitante: 60 MB son muchos datos móviles para una portada. Con eso entra
 * un fondo de 10 a 20 segundos en 1080p.
 */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

/**
 * Desde aquí se avisa, aunque se acepte. La tienda no recodifica el video, así
 * que cada visitante descarga exactamente lo que se subió.
 */
export const COMFORTABLE_VIDEO_BYTES = 8 * 1024 * 1024;

/** MP4 y WEBM son los que cualquier navegador reproduce sin conversión. */
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

/**
 * Códecs que los navegadores decodifican sin extensiones.
 *
 * Importa porque el problema no se ve al subir: un MP4 en H.265 —lo que graba
 * un iPhone en "alta eficiencia"— se guarda bien y en la portada no se ve
 * nada, sin error. Es mejor rechazarlo y pedir H.264.
 */
const PLAYABLE_MP4_CODECS = ['avc1', 'avc3', 'vp09', 'av01'];

const CODEC_NAMES: Record<string, string> = {
  hvc1: 'H.265 (HEVC)',
  hev1: 'H.265 (HEVC)',
  vp08: 'VP8',
  mp4v: 'MPEG-4 Visual',
};

/**
 * Códecs declarados dentro de un MP4.
 *
 * Un MP4 es un árbol de cajas con su tamaño y su nombre. El códec de cada
 * pista vive en `moov > trak > mdia > minf > stbl > stsd`, cuya primera
 * entrada empieza con las cuatro letras que lo identifican. Se recorre solo
 * esa rama, así que el trabajo no depende de cuánto pese el archivo.
 */
export function mp4Codecs(bytes: Buffer): string[] {
  const found: string[] = [];

  function walk(start: number, end: number, path: string[]): void {
    let offset = start;

    while (offset + 8 <= end) {
      const size = bytes.readUInt32BE(offset);
      const name = bytes.toString('latin1', offset + 4, offset + 8);
      // Tamaño 0 es "hasta el final"; 1, tamaño de 64 bits tras el nombre, que
      // solo aparece en archivos de una sola caja enorme y no se persigue.
      const length = size === 0 ? end - offset : size;
      if (length < 8) return;

      const inner = offset + 8;
      const outer = Math.min(offset + length, end);

      if (name === path[0]) {
        if (path.length === 1) {
          // `stsd` lleva delante una versión y el número de entradas.
          if (inner + 16 <= outer) found.push(bytes.toString('latin1', inner + 12, inner + 16));
        } else {
          walk(inner, outer, path.slice(1));
        }
      }

      offset += length;
    }
  }

  try {
    walk(0, bytes.length, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd']);
  } catch {
    return [];
  }

  return found;
}

/**
 * Si el índice (`moov`) va después del contenido (`mdat`), el navegador no
 * puede empezar a reproducir hasta ir a buscarlo al final. Los editores lo
 * arreglan con la opción "faststart" u "optimizar para web".
 */
export function mp4IndexAtEnd(bytes: Buffer): boolean {
  let offset = 0;
  let vistoMdat = false;

  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const name = bytes.toString('latin1', offset + 4, offset + 8);
    const length = size === 0 ? bytes.length - offset : size;
    if (length < 8) return false;

    if (name === 'moov') return vistoMdat;
    if (name === 'mdat') vistoMdat = true;

    offset += length;
  }

  return false;
}

/**
 * Ante la duda acepta: si no se reconoce ninguna pista se deja pasar, porque
 * rechazar un video que funciona es peor que aceptar uno que quizá no se vea.
 */
export function unplayableMp4Reason(bytes: Buffer): string | null {
  const codecs = mp4Codecs(bytes);
  if (codecs.length === 0) return null;
  if (codecs.some((codec) => PLAYABLE_MP4_CODECS.includes(codec))) return null;

  const conocido = codecs.find((codec) => CODEC_NAMES[codec]);
  if (!conocido) return null;

  return (
    `El MP4 está en ${CODEC_NAMES[conocido]}, que los navegadores no reproducen. ` +
    'Expórtalo en H.264 y vuelve a subirlo.'
  );
}

export type MediaError = { error: string };
export type MediaResult = { url: string; id: string; warning?: string };

/** Un SVG puede traer scripts; se rechaza en lugar de guardarlo. */
function svgIsSafe(buffer: Buffer): boolean {
  const source = buffer.toString('utf8').toLowerCase();
  return (
    !source.includes('<script') && !source.includes('javascript:') && !/\son\w+\s*=/.test(source)
  );
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export async function storeMediaImage(
  file: File | { name: string; type: string; bytes: Buffer },
  alt = '',
): Promise<MediaResult | MediaError> {
  const entrada = await toBytes(file);
  if (!entrada) return { error: 'No se recibió ningún archivo.' };

  if (!ALLOWED_IMAGE_TYPES.includes(entrada.type)) {
    return { error: 'Formato no admitido. Usa JPG, PNG, WEBP, AVIF o SVG.' };
  }
  if (entrada.bytes.length > MAX_IMAGE_BYTES) {
    return {
      error: `La imagen pesa ${mb(entrada.bytes.length)} MB y el máximo son ${
        MAX_IMAGE_BYTES / 1024 / 1024
      } MB.`,
    };
  }
  if (entrada.type === 'image/svg+xml' && !svgIsSafe(entrada.bytes)) {
    return { error: 'El SVG contiene código ejecutable y no se puede usar.' };
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: entrada.name.slice(0, 200) || 'imagen',
      mimeType: entrada.type,
      size: entrada.bytes.length,
      bytes: entrada.bytes,
      alt: alt.slice(0, 200),
    },
    select: { id: true },
  });

  // Las versiones se preparan mientras el panel sigue abierto, para que ningún
  // visitante las espere.
  warmVariants(asset.id, entrada.type);

  return { id: asset.id, url: `/api/media/${asset.id}` };
}

/**
 * Guarda un video. Va aparte de las imágenes: no se reencodea, no tiene
 * versiones por ancho y pesa un orden de magnitud más.
 */
export async function storeMediaVideo(
  file: File | { name: string; type: string; bytes: Buffer },
): Promise<MediaResult | MediaError> {
  const entrada = await toBytes(file);
  if (!entrada) return { error: 'No se recibió ningún archivo.' };

  if (!ALLOWED_VIDEO_TYPES.includes(entrada.type)) {
    return { error: 'Formato no admitido. Usa un archivo .mp4 o .webm.' };
  }
  if (entrada.bytes.length > MAX_VIDEO_BYTES) {
    return {
      error: `El video pesa ${mb(entrada.bytes.length)} MB y el máximo son ${
        MAX_VIDEO_BYTES / 1024 / 1024
      } MB. Recórtalo o bájale la calidad.`,
    };
  }

  const avisos: string[] = [];

  if (entrada.type === 'video/mp4') {
    const problema = unplayableMp4Reason(entrada.bytes);
    if (problema) return { error: problema };

    if (mp4IndexAtEnd(entrada.bytes)) {
      avisos.push(
        'El índice del video está al final del archivo, así que el navegador tiene que ir a ' +
          'buscarlo antes de empezar. Al exportarlo marca "optimizar para web" (faststart).',
      );
    }
  }

  if (entrada.bytes.length > COMFORTABLE_VIDEO_BYTES) {
    avisos.push(
      `El video pesa ${mb(entrada.bytes.length)} MB y se descarga entero en cada visita, porque ` +
        'no se recomprime. Para un fondo conviene dejarlo bajo 8 MB: 10 a 15 segundos en 1080p.',
    );
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: entrada.name.slice(0, 200) || 'video',
      mimeType: entrada.type,
      size: entrada.bytes.length,
      bytes: entrada.bytes,
      alt: '',
    },
    select: { id: true },
  });

  return {
    id: asset.id,
    url: `/api/media/${asset.id}`,
    warning: avisos.length > 0 ? avisos.join(' ') : undefined,
  };
}

async function toBytes(
  file: File | { name: string; type: string; bytes: Buffer },
): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  if (typeof File !== 'undefined' && file instanceof File) {
    if (file.size === 0) return null;
    return { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
  }
  const plain = file as { name: string; type: string; bytes: Buffer };
  if (!plain?.bytes?.length) return null;
  return plain;
}

/** Cuánto se espera a un servidor ajeno antes de darlo por perdido. */
const REMOTE_TIMEOUT_MS = 15_000;

/**
 * Descarga una dirección externa y la guarda como si se hubiera subido.
 *
 * Importarla —en vez de dejar el enlace apuntando afuera— es lo que permite
 * optimizarla y lo que evita que la portada se quede sin imagen el día que ese
 * servidor deje de responder.
 */
export async function importMediaFromUrl(
  url: string,
  kind: 'image' | 'video',
): Promise<MediaResult | MediaError> {
  let target: URL;
  try {
    target = new URL(url.trim());
  } catch {
    return { error: 'La dirección no es válida.' };
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return { error: 'Solo se pueden traer direcciones http o https.' };
  }

  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), REMOTE_TIMEOUT_MS);

  try {
    const response = await fetch(target, { signal: control.signal, redirect: 'follow' });
    if (!response.ok) {
      return { error: `El servidor respondió ${response.status} al pedir el archivo.` };
    }

    const limite = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const declarado = Number(response.headers.get('content-length') ?? 0);
    if (declarado > limite) {
      return { error: `El archivo pesa ${mb(declarado)} MB y supera el máximo.` };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > limite) {
      return { error: `El archivo pesa ${mb(bytes.length)} MB y supera el máximo.` };
    }

    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const name = decodeURIComponent(target.pathname.split('/').pop() || 'archivo').slice(0, 200);
    const entrada = { name, type, bytes };

    return kind === 'video' ? storeMediaVideo(entrada) : storeMediaImage(entrada);
  } catch {
    return { error: 'No se pudo descargar el archivo desde esa dirección.' };
  } finally {
    clearTimeout(corte);
  }
}

/** Tipo y tamaño, sin traer el contenido. */
export async function getAssetMeta(id: string): Promise<{ mimeType: string; size: number } | null> {
  return prisma.mediaAsset.findUnique({ where: { id }, select: { mimeType: true, size: true } });
}

/**
 * Un pedazo del archivo, cortado por Postgres.
 *
 * Es lo que hace que un video grande se pueda ver. Un `<video>` pide el
 * principio, salta al final a buscar el índice y sigue por tramos; si cada
 * petición leyera la fila entera, un archivo de 30 MB movería cientos de megas
 * para reproducir unos segundos.
 *
 * Los dos números van con `::int` explícito: Prisma manda cualquier número de
 * JavaScript como bigint, y no existe un `substring` de bytea que lo acepte.
 */
export async function getAssetChunk(
  id: string,
  start: number,
  length: number,
): Promise<Buffer | null> {
  const rows = await prisma.$queryRaw<{ chunk: Buffer | Uint8Array | null }[]>`
    SELECT substring("bytes" FROM ${start + 1}::int FOR ${length}::int) AS chunk
    FROM "MediaAsset"
    WHERE "id" = ${id}
  `;
  const chunk = rows[0]?.chunk;
  return chunk ? Buffer.from(chunk) : null;
}

/**
 * Máximo que se manda en una respuesta de video. Contestar un tramo más corto
 * del pedido es válido —para eso está el 206— y mantiene acotado lo que ocupa
 * cada petición en memoria.
 */
export const VIDEO_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Interpreta una cabecera `Range` de un solo tramo.
 *
 * `null` cuando no hay cabecera o no se entiende, donde mandar el archivo
 * completo es una respuesta válida. `'imposible'` cuando empieza más allá del
 * final, que es un 416.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'imposible' | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  // "bytes=-500" son los últimos 500 bytes, no del 0 al 500.
  if (!rawStart) {
    const length = Number(rawEnd);
    if (!Number.isFinite(length) || length <= 0) return null;
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= size || start > end) return 'imposible';

  return { start, end: Math.min(end, size - 1) };
}

export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

// ─────────────────────────────────────────────────────────────
// Versiones optimizadas
// ─────────────────────────────────────────────────────────────

const MODERN_FORMATS = ['avif', 'webp'] as const;
export type MediaFormat = (typeof MODERN_FORMATS)[number];

/** Un SVG ya escala solo y un video no pasa por sharp. */
const NOT_OPTIMIZABLE = ['image/svg+xml', 'video/mp4', 'video/webm'];

/**
 * La lista de anchos es cerrada: uno libre en la URL dejaría que cualquiera
 * pidiera mil tamaños y llenara la base de versiones.
 */
export function toMediaWidth(value: string | null): number | null {
  const width = Number(value);
  return MEDIA_WIDTHS.includes(width) ? width : null;
}

export function pickFormat(accept: string | null): MediaFormat | null {
  const header = (accept ?? '').toLowerCase();
  return MODERN_FORMATS.find((format) => header.includes(`image/${format}`)) ?? null;
}

/**
 * La imagen en el ancho y formato pedidos.
 *
 * El original nunca se modifica: la versión optimizada se guarda aparte como
 * caché y, si algo falla, se devuelve el original tal cual.
 */
export async function getOptimizedImage(
  id: string,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string; size: number } | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
  if (!asset) return null;

  const original = { bytes: Buffer.from(asset.bytes), mimeType: asset.mimeType, size: asset.size };
  if (NOT_OPTIMIZABLE.includes(asset.mimeType)) return original;
  if (!width && !format) return original;

  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };

  const cached = await prisma.mediaVariant
    .findUnique({
      where: { mediaId_width_format: key },
      select: { bytes: true, mimeType: true, size: true },
    })
    .catch(() => null);
  if (cached) {
    return { bytes: Buffer.from(cached.bytes), mimeType: cached.mimeType, size: cached.size };
  }

  // Nadie espera a que se genere: comprimir cuesta segundos y hacerlo mientras
  // alguien mira una pantalla en blanco es el problema que esto venía a
  // resolver. Se manda el original y las versiones quedan para la siguiente.
  warmVariants(id, original.mimeType);
  return original;
}

/** Variantes que ya se están calculando, para no repetir el trabajo. */
const enCurso = new Set<string>();

async function ensureVariant(
  id: string,
  originalBytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<void> {
  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };
  const marca = `${key.mediaId}|${key.width}|${key.format}`;
  if (enCurso.has(marca)) return;
  enCurso.add(marca);

  try {
    const existe = await prisma.mediaVariant
      .findUnique({ where: { mediaId_width_format: key }, select: { id: true } })
      .catch(() => null);
    if (existe) return;

    const rendered = await render(originalBytes, width, format).catch(() => null);
    if (!rendered) return;

    // Con fotos ya comprimidas al límite la versión "optimizada" puede pesar
    // más que el original; ahí no vale la pena guardarla.
    if (!width && rendered.bytes.length >= originalBytes.length) return;

    // `createMany` con `skipDuplicates` porque entre la consulta de arriba y
    // esta línea otra petición pudo guardar la misma versión.
    await prisma.mediaVariant
      .createMany({
        data: [{ ...key, mimeType: rendered.mimeType, size: rendered.bytes.length, bytes: rendered.bytes }],
        skipDuplicates: true,
      })
      .catch(() => undefined);
  } finally {
    enCurso.delete(marca);
  }
}

/**
 * Imágenes en espera de que se les preparen las versiones. Es una fila y se
 * atiende de a una: subir ocho fotos lanzaría ochenta reencodeados a la vez y
 * el servidor de la tienda tiene uno o dos núcleos.
 */
const enEspera: string[] = [];
let atendiendo = false;

export function warmVariants(id: string, mimeType: string): void {
  if (NOT_OPTIMIZABLE.includes(mimeType)) return;
  if (enEspera.includes(id)) return;

  enEspera.push(id);
  if (atendiendo) return;
  atendiendo = true;

  // El respiro evita que la compresión le robe el procesador a la misma
  // petición que la disparó.
  setTimeout(() => void atenderEspera(), WARM_DELAY_MS).unref?.();
}

/**
 * Los bytes se releen al llegarle el turno a cada imagen: guardarlos en la
 * fila dejaría decenas de megas retenidos en memoria esperando.
 */
async function atenderEspera(): Promise<void> {
  try {
    while (enEspera.length > 0) {
      const id = enEspera.shift()!;
      const asset = await prisma.mediaAsset
        .findUnique({ where: { id }, select: { bytes: true, mimeType: true } })
        .catch(() => null);
      if (!asset || NOT_OPTIMIZABLE.includes(asset.mimeType)) continue;

      const bytes = Buffer.from(asset.bytes);
      for (const format of MODERN_FORMATS) {
        for (const width of [null, ...MEDIA_WIDTHS]) {
          await ensureVariant(id, bytes, width, format).catch(() => undefined);
        }
      }
    }
  } finally {
    atendiendo = false;
  }
}

const WARM_DELAY_MS = 4000;

/**
 * Reencodea con sharp. Se importa aquí dentro porque es un módulo nativo: si
 * el despliegue no lo trae, falla esta función y quien llama sirve el
 * original, en lugar de tumbar la tienda.
 */
async function render(
  bytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const sharp = (await import('sharp')).default;

  // Un hilo por operación: dejar que libvips se quede los pocos núcleos del
  // servidor deja la página esperando.
  sharp.concurrency(1);

  let pipeline = sharp(bytes, { failOn: 'none' });

  const meta = await pipeline.metadata();
  // Nunca se agranda: pedir 1920 de una foto de 800 daría una versión borrosa
  // y más pesada que el original.
  if (width && meta.width && width < meta.width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }

  // El esfuerzo de AVIF va al mínimo porque el reparto es malo: subirlo
  // multiplica por seis el tiempo para ahorrar unos pocos KB.
  if (format === 'avif') {
    return {
      bytes: await pipeline.avif({ quality: 62, effort: 0 }).toBuffer(),
      mimeType: 'image/avif',
    };
  }
  if (format === 'webp') {
    return { bytes: await pipeline.webp({ quality: 85 }).toBuffer(), mimeType: 'image/webp' };
  }

  if (!width) return null;
  if (meta.format === 'png') {
    return {
      bytes: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
      mimeType: 'image/png',
    };
  }
  return {
    bytes: await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
    mimeType: 'image/jpeg',
  };
}

/**
 * Los medios que alguna fila está usando ahora mismo.
 *
 * No lleva una lista de sitios donde mirar: se le pregunta al esquema. Se
 * recorre cada columna de texto buscando `/api/media/<id>`, y así una columna
 * nueva queda cubierta desde el día que se crea, incluida una URL pegada
 * dentro de un ajuste en JSON.
 */
async function usedMediaIds(): Promise<Set<string>> {
  // Estas dos guardan los archivos, no los referencian.
  const propias = ['MediaAsset', 'MediaVariant'];

  const consultas = Prisma.dmmf.datamodel.models
    .filter((model) => !propias.includes(model.name))
    .flatMap((model) => {
      const columnas = model.fields
        .filter((field) => field.kind === 'scalar' && (field.type === 'String' || field.type === 'Json'))
        .map((field) => {
          const columna = `"${field.dbName ?? field.name}"`;
          // Una columna JSON —los ajustes del sitio, con el logo dentro— se
          // mira como texto: sin esto el logo quedaría sin referencias y la
          // limpieza lo borraría a los siete días.
          if (field.type === 'Json') return `${columna}::text`;
          return field.isList ? `array_to_string(${columna}, ' ')` : columna;
        });
      if (columnas.length === 0) return [];

      const tabla = `"${model.dbName ?? model.name}"`;
      return [
        `SELECT DISTINCT hallazgo[1] AS id FROM ${tabla}, ` +
          `LATERAL regexp_matches(concat_ws(' ', ${columnas.join(', ')}), ` +
          `'/api/media/([A-Za-z0-9_-]{1,40})', 'g') AS hallazgo`,
      ];
    });

  const filas = await prisma.$queryRawUnsafe<{ id: string }[]>(consultas.join(' UNION '));
  return new Set(filas.map((fila) => fila.id));
}

/** Cuánto se le respeta a un archivo recién subido antes de darlo por huérfano. */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Borra los archivos que ya no referencia nadie. Ante la duda no borra: si la
 * búsqueda falla se sale sin tocar nada, porque guardar de más cuesta disco y
 * borrar una imagen en uso no tiene vuelta atrás.
 */
export async function purgeOrphanMedia(): Promise<number> {
  const assets = await prisma.mediaAsset.findMany({ select: { id: true, createdAt: true } });
  if (assets.length === 0) return 0;

  const used = await usedMediaIds().catch(() => null);
  if (!used) return 0;

  const cutoff = Date.now() - GRACE_MS;
  const orphans = assets
    .filter((asset) => !used.has(asset.id) && asset.createdAt.getTime() < cutoff)
    .map((asset) => asset.id);

  if (orphans.length === 0) return 0;

  const removed = await prisma.mediaAsset.deleteMany({ where: { id: { in: orphans } } });
  return removed.count;
}
