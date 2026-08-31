import 'server-only';
import { unlink } from 'fs/promises';
import path from 'path';
import { deleteMediaByUrl } from './media';

/**
 * Borrado de imágenes.
 *
 * Conviven dos orígenes: las del catálogo inicial, que el seed escribe en
 * disco, y las que sube el panel, que viven en la base y se sirven desde
 * /api/media. Lo que se sube ya no va a disco: en el contenedor esos archivos
 * no se sirven hasta reiniciar y desaparecen en el siguiente despliegue.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads';

export async function deleteImage(url: string): Promise<void> {
  if (url.startsWith('/api/media/')) {
    await deleteMediaByUrl(url);
    return;
  }
  if (!url.startsWith(PUBLIC_PREFIX)) return;

  const relative = url.slice(PUBLIC_PREFIX.length).replace(/^\/+/, '');
  // Evita salir del directorio de subidas con rutas tipo ../../
  const target = path.resolve(UPLOAD_DIR, relative);
  if (!target.startsWith(path.resolve(UPLOAD_DIR))) return;

  try {
    await unlink(target);
  } catch {
    // El archivo ya no existe: no es un error para el usuario.
  }
}
