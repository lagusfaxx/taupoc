'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  assignImageColor, deleteProductImage, reorderImages, setPrimaryImage, uploadProductImages,
} from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconCheck, IconTrash } from '@/components/ui/Icons';

export interface ManagedImage {
  id: string;
  url: string;
  alt: string;
  colorId: string | null;
  isPrimary: boolean;
}

export function ImageManager({
  productId,
  images,
  colors,
}: {
  productId: string;
  images: ManagedImage[];
  colors: { id: string; name: string; hex: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [targetColor, setTargetColor] = useState<string>('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(images.map((i) => i.id));

  const ordered = order
    .map((id) => images.find((i) => i.id === id))
    .filter((i): i is ManagedImage => Boolean(i));
  // Imágenes recién subidas que aún no están en el orden local.
  for (const image of images) if (!order.includes(image.id)) ordered.push(image);

  async function upload(files: FileList | File[]) {
    // No se filtra por `f.type`: el navegador manda cadena vacía o
    // `application/octet-stream` según el sistema, y con eso el archivo se
    // descartaba en silencio, sin subida y sin mensaje. El servidor decide
    // mirando los bytes.
    const list = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i.test(f.name),
    );
    if (list.length === 0) return;

    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set('productId', productId);
    if (targetColor) formData.set('colorId', targetColor);
    for (const file of list) formData.append('files', file);

    const result = await uploadProductImages(formData);
    setUploading(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) router.refresh();
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) void upload(event.dataTransfer.files);
  }

  function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = ordered.map((i) => i.id);
    const from = current.indexOf(dragId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0) return;
    current.splice(to, 0, ...current.splice(from, 1));
    setOrder(current);
    startTransition(async () => {
      await reorderImages(current);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[200px]">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Asignar las nuevas imágenes a
          </span>
          <select
            value={targetColor}
            onChange={(e) => setTargetColor(e.target.value)}
            className="h-10 w-full border border-line bg-ink-900 px-3 text-[13.5px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="">Sin color (galería general)</option>
            {colors.map((color) => (
              <option key={color.id} value={color.id}>{color.name}</option>
            ))}
          </select>
        </label>
        <p className="flex-1 text-[12px] leading-relaxed text-chalk-faint">
          Las imágenes asignadas a un color se muestran cuando el cliente selecciona ese color en la
          ficha. Se convierten a WEBP y se redimensionan automáticamente.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver ? 'accent-border bg-ink-800' : 'border-line-bright bg-ink-900',
        )}
      >
        <p className="font-display text-[13px] uppercase tracking-widest text-chalk">
          {uploading ? 'Subiendo…' : 'Arrastra las imágenes acá'}
        </p>
        <p className="mt-2 text-[12.5px] text-chalk-faint">
          JPG, PNG, WEBP, AVIF o HEIC · hasta 20 MB cada una
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-4 h-10 border border-line-bright px-5 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk disabled:opacity-50"
        >
          Buscar archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {message ? (
        <p
          role="status"
          className={cn(
            'mt-3 border px-3.5 py-2.5 text-[13px]',
            message.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {message.text}
        </p>
      ) : null}

      {ordered.length > 0 ? (
        <>
          <p className="mb-3 mt-6 text-[12px] text-chalk-faint">
            Arrastra las miniaturas para cambiar el orden. La primera imagen es la que se ve en el catálogo.
          </p>
          <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', pending && 'opacity-60')}>
            {ordered.map((image) => (
              <li
                key={image.id}
                draggable
                onDragStart={() => setDragId(image.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reorder(image.id)}
                className={cn(
                  'group relative cursor-move border bg-ink-900 transition-colors',
                  image.isPrimary ? 'accent-border' : 'border-line',
                  dragId === image.id && 'opacity-40',
                )}
              >
                <div className="relative aspect-[4/5]">
                  <Image src={image.url} alt={image.alt} fill sizes="220px" className="object-cover" />
                  {image.isPrimary ? (
                    <span className="absolute left-1.5 top-1.5 accent-bg px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest">
                      Principal
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5 p-2">
                  <label className="sr-only" htmlFor={`img-color-${image.id}`}>Color de la imagen</label>
                  <select
                    id={`img-color-${image.id}`}
                    value={image.colorId ?? ''}
                    onChange={(e) =>
                      startTransition(async () => {
                        await assignImageColor(image.id, e.target.value || null);
                        router.refresh();
                      })
                    }
                    className="h-8 w-full border border-line bg-ink-800 px-2 text-[11.5px] text-chalk focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="">Sin color</option>
                    {colors.map((color) => (
                      <option key={color.id} value={color.id}>{color.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      disabled={image.isPrimary}
                      onClick={() =>
                        startTransition(async () => {
                          await setPrimaryImage(image.id);
                          router.refresh();
                        })
                      }
                      className="inline-flex items-center gap-1 font-display text-[9.5px] uppercase tracking-widest text-chalk-faint hover:accent-text disabled:opacity-40"
                    >
                      <IconCheck className="h-3 w-3" />
                      Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('¿Eliminar esta imagen?')) {
                          startTransition(async () => {
                            await deleteProductImage(image.id);
                            router.refresh();
                          });
                        }
                      }}
                      aria-label="Eliminar imagen"
                      className="text-chalk-faint hover:text-signal-bad"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-5 text-[13px] text-chalk-faint">
          Este producto todavía no tiene imágenes.
        </p>
      )}
    </div>
  );
}
