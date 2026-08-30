import { NextResponse } from 'next/server';
import {
  VIDEO_CHUNK_BYTES,
  getAssetChunk,
  getAssetMeta,
  getOptimizedImage,
  isVideoType,
  parseByteRange,
  pickFormat,
  toMediaWidth,
} from '@/lib/media';

export const runtime = 'nodejs';

/**
 * Sirve un archivo subido desde el panel.
 *
 * El id se genera al subir y no se reutiliza, así que el contenido de una URL
 * nunca cambia y puede cachearse indefinidamente. Reemplazar el logo o la foto
 * de un banner crea un id nuevo, y con él una URL nueva: por eso el cambio se
 * ve al instante aunque el navegador tenga la anterior guardada.
 *
 * Con `?w=` se pide una versión más estrecha y, si el navegador acepta AVIF o
 * WEBP, se manda en ese formato. El original nunca se toca.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Un video se sirve aparte: no tiene versiones por ancho y necesita
  // responder por tramos. Se preguntan primero dos columnas cortas para no
  // leer los bytes dos veces por petición.
  let meta;
  try {
    meta = await getAssetMeta(id);
  } catch {
    return new NextResponse('Error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (meta && isVideoType(meta.mimeType)) return serveVideo(request, id, meta);

  const width = toMediaWidth(new URL(request.url).searchParams.get('w'));
  const format = pickFormat(request.headers.get('accept'));

  // Un tropiezo pasajero de la base no es una imagen borrada. Como 404 el
  // navegador deja de reintentar y la página queda con el hueco; el 500 sin
  // caché manda el siguiente intento otra vez al servidor.
  let image;
  try {
    image = await getOptimizedImage(id, width, format);
  } catch {
    return new NextResponse('Error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!image) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(image.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // La respuesta cambia según lo que acepte el navegador, así que un caché
      // compartido no puede servirle AVIF a quien no lo entiende.
      Vary: 'Accept',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Un `<video>` pide un tramo ("Range: bytes=0-") y espera un 206 con ese
 * pedazo; Safari directamente no reproduce sin eso. El corte lo hace Postgres
 * y el tramo tiene tope, para que un archivo de varios megas no se cargue
 * entero en memoria en cada una de las muchas peticiones que genera.
 */
async function serveVideo(
  request: Request,
  id: string,
  meta: { mimeType: string; size: number },
): Promise<NextResponse> {
  const common = {
    'Content-Type': meta.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  };

  const range = parseByteRange(request.headers.get('range'), meta.size);

  if (range === 'imposible') {
    return new NextResponse(null, {
      status: 416,
      headers: { ...common, 'Content-Range': `bytes */${meta.size}` },
    });
  }

  // Sin cabecera `Range` no hay reproductor detrás, sino alguien abriendo la
  // dirección directamente.
  const start = range ? range.start : 0;
  const end = range ? Math.min(range.end, start + VIDEO_CHUNK_BYTES - 1) : meta.size - 1;
  const length = end - start + 1;

  const chunk = await getAssetChunk(id, start, length).catch(() => null);
  if (!chunk) {
    return new NextResponse('Error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!range) {
    return new NextResponse(new Uint8Array(chunk), {
      headers: { ...common, 'Content-Length': String(chunk.length) },
    });
  }

  return new NextResponse(new Uint8Array(chunk), {
    status: 206,
    headers: {
      ...common,
      'Content-Length': String(chunk.length),
      'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${meta.size}`,
    },
  });
}
