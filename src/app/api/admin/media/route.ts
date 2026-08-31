import { NextResponse } from 'next/server';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { storeMediaImage, storeMediaVideo } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recibe un archivo del panel y devuelve la URL con la que referenciarlo.
 *
 * No pasa por una Server Action porque estas traen un tope de tamaño propio
 * que cortaría un video antes de llegar a las comprobaciones.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  const file = formData.get('file');
  const alt = String(formData.get('alt') ?? '');
  // Lo que decide es el tipo del archivo, que se comprueba dentro; esto solo
  // elige contra qué lista se valida, para que subir un JPG al campo de video
  // dé un error que se entienda.
  const kind = String(formData.get('kind') ?? 'image');

  const result =
    kind === 'video' ? await storeMediaVideo(file as File) : await storeMediaImage(file as File, alt);

  if ('error' in result) {
    // El motivo también queda en el registro del servidor: en un despliegue
    // remoto es lo único que se puede mirar cuando alguien reporta que "no
    // sube" sin más detalle.
    const info = file instanceof File ? `${file.name} · ${file.type || 'sin tipo'} · ${file.size} B` : 'sin archivo';
    console.warn(`[media:rechazado] ${result.error} — ${info}`);
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
