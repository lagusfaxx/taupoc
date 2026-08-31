import 'server-only';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { TYPE_NAMES, sniffImageType } from './file-type';

/**
 * Almacenamiento de imágenes en disco. En Coolify, UPLOAD_DIR debe apuntar a un
 * volumen persistente montado en /app/public/uploads para sobrevivir los deploys.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads';

const MAX_BYTES = 20 * 1024 * 1024;
// Todo pasa por sharp y sale en WEBP, así que basta con que sharp sepa leerlo.
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/heic',
]);

export interface StoredImage {
  url: string;
  width: number;
  height: number;
}

export async function storeImage(file: File): Promise<StoredImage> {
  if (file.size > MAX_BYTES) {
    throw new Error(`La imagen supera los ${MAX_BYTES / 1024 / 1024} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // El tipo se lee de los bytes: el navegador manda `image/jpg`, cadena vacía
  // o `application/octet-stream` según el sistema, y rechazar por ese dato deja
  // fuera fotos que están perfectas.
  const tipo = sniffImageType(buffer);
  if (!tipo || !ALLOWED.has(tipo)) {
    throw new Error(
      tipo && TYPE_NAMES[tipo]
        ? `No se puede usar un archivo ${TYPE_NAMES[tipo]}. Expórtalo como JPG.`
        : 'El archivo no parece una imagen. Usa JPG, PNG, WEBP o AVIF.',
    );
  }
  const id = randomUUID();
  const folder = path.join(UPLOAD_DIR, id.slice(0, 2));
  await mkdir(folder, { recursive: true });

  // Se normaliza a WEBP: pesa menos y next/image lo sirve en AVIF cuando puede.
  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const filename = `${id}.webp`;
  await writeFile(path.join(folder, filename), data);

  return {
    url: `${PUBLIC_PREFIX}/${id.slice(0, 2)}/${filename}`,
    width: info.width,
    height: info.height,
  };
}

export async function deleteImage(url: string): Promise<void> {
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
