import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { getOptimizedImage } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Imagen que se ve al compartir un enlace del sitio.
 *
 * Vive en una dirección fija porque las redes guardan la vista previa por URL;
 * si cambiara al cambiar la imagen, cada enlace ya compartido apuntaría a una
 * dirección muerta. Lo que devuelve es lo que el panel tenga configurado, y si
 * no hay nada, la imagen que viene con el sitio.
 *
 * El caché es corto: al cambiarla en el panel, la próxima vez que una red
 * pida la vista previa ya recibe la nueva.
 */
export async function GET() {
  const settings = await getSettings();
  const configurada = settings.shareImageUrl.trim();

  const cabeceras = (tipo: string) => ({
    'Content-Type': tipo,
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff',
  });

  const media = /^\/api\/media\/([A-Za-z0-9_-]{1,40})$/.exec(configurada);
  if (media) {
    const image = await getOptimizedImage(media[1], 1280, null).catch(() => null);
    if (image) {
      return new NextResponse(new Uint8Array(image.bytes), { headers: cabeceras(image.mimeType) });
    }
  }

  // Una dirección externa se reenvía; la vista previa la resuelve la red.
  if (/^https?:\/\//i.test(configurada)) {
    return NextResponse.redirect(configurada, 302);
  }

  try {
    const bytes = await readFile(path.join(process.cwd(), 'public', 'og-default.png'));
    return new NextResponse(new Uint8Array(bytes), { headers: cabeceras('image/png') });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
