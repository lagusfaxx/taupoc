import 'server-only';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

/**
 * Almacenamiento de imágenes en disco. En Coolify, UPLOAD_DIR debe apuntar a un
 * volumen persistente montado en /app/public/uploads para sobrevivir los deploys.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface StoredImage {
  url: string;
  width: number;
  height: number;
}

export async function storeImage(file: File): Promise<StoredImage> {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG, WEBP o AVIF.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('La imagen supera los 10 MB.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
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
