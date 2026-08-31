'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProductImageFromUrl, assignImageColor, deleteProductImage, reorderImages,
  replaceProductImage, replaceProductImageFromUrl, setPrimaryImage, uploadProductImages,
} from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { colorLabel } from '@/lib/colors';
import { IconCheck, IconSearch, IconTrash } from '@/components/ui/Icons';

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
  colors: { id: string; name: string; code: string | null; hex: string }[];
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
  const [replacing, setReplacing] = useState<string | null>(null);
  const [urlFor, setUrlFor] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const nuevaUrlRef = useRef<HTMLInputElement>(null);

  // El buscador acota toda la pestaña a un color: la lista de abajo y el
  // selector con el que se asignan las fotos nuevas.
  const termino = busqueda.trim().toLowerCase();
  const coincide = (color: { name: string; code: string | null }) =>
    !termino ||
    color.name.toLowerCase().includes(termino) ||
    (color.code ?? '').toLowerCase().includes(termino);

  const coloresVisibles = colors.filter(coincide);
  const idsVisibles = new Set(coloresVisibles.map((color) => color.id));

  const ordered = order
    .map((id) => images.find((i) => i.id === id))
    .filter((i): i is ManagedImage => Boolean(i));
  // Imágenes recién subidas que aún no están en el orden local.
  for (const image of images) if (!order.includes(image.id)) ordered.push(image);

  const visibles = termino
    ? ordered.filter((image) => image.colorId && idsVisibles.has(image.colorId))
    : ordered;

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

  async function replace(imageId: string, file: File | undefined) {
    if (!file) return;
    setReplacing(imageId);
    setMessage(null);

    const formData = new FormData();
    formData.set('imageId', imageId);
    formData.set('file', file);

    const result = await replaceProductImage(formData);
    setReplacing(null);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) router.refresh();
  }

  function replaceFromUrl(imageId: string, url: string) {
    if (!url.trim()) return;
    setReplacing(imageId);
    setMessage(null);
    startTransition(async () => {
      const result = await replaceProductImageFromUrl(imageId, url);
      setReplacing(null);
      setUrlFor(null);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function addFromUrl() {
    const url = nuevaUrlRef.current?.value ?? '';
    if (!url.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addProductImageFromUrl(productId, targetColor || null, url);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) {
        if (nuevaUrlRef.current) nuevaUrlRef.current.value = '';
        router.refresh();
      }
    });
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

  /** Las fotos de cada color, en el orden del catálogo. */
  const grupos = [
    ...coloresVisibles.map((color) => ({
      key: color.id,
      titulo: colorLabel(color),
      hex: color.hex,
      imagenes: visibles.filter((image) => image.colorId === color.id),
    })),
    ...(termino
      ? []
      : [
          {
            key: 'sin-color',
            titulo: 'Sin color · galería general',
            hex: null,
            imagenes: visibles.filter((image) => !image.colorId),
          },
        ]),
  ];

  return (
    <div>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(200px,260px)_1fr]">
        <label>
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Asignar las nuevas fotos a
          </span>
          <select
            value={targetColor}
            onChange={(e) => setTargetColor(e.target.value)}
            className="h-10 w-full border border-line bg-ink-900 px-3 text-[13.5px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="">Sin color (galería general)</option>
            {coloresVisibles.map((color) => (
              <option key={color.id} value={color.id}>
                {colorLabel(color)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            O pega la dirección de una foto
          </span>
          <div className="flex gap-2">
            <input
              ref={nuevaUrlRef}
              type="url"
              placeholder="https://…"
              className="h-10 min-w-0 flex-1 border border-line bg-ink-900 px-3 text-[13.5px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={addFromUrl}
              disabled={pending}
              className="h-10 shrink-0 border border-line-bright px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </label>
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-chalk-faint">
        Las fotos asignadas a un color se muestran cuando el cliente selecciona ese color en la
        ficha. Una dirección pegada se descarga y queda guardada en la tienda.
      </p>

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
          {uploading ? 'Subiendo…' : 'Arrastra las fotos acá'}
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
          <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-3">
            <label className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-chalk-faint" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar color por nombre o código"
                aria-label="Buscar color"
                className="h-10 w-[280px] max-w-full border border-line bg-ink-900 pl-9 pr-3 text-[13.5px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <p className="text-[12px] text-chalk-faint">
              Arrastra las miniaturas para cambiar el orden. La primera es la que se ve en el catálogo.
            </p>
          </div>

          {grupos.every((grupo) => grupo.imagenes.length === 0) ? (
            <p className="text-[13px] text-chalk-faint">
              Ningún color coincide con «{busqueda}».
            </p>
          ) : null}

          <div className={cn('space-y-7', pending && 'opacity-60')}>
            {grupos.map((grupo) => (
              <section key={grupo.key}>
                <div className="mb-2.5 flex items-center gap-2.5 border-b border-line pb-2">
                  {grupo.hex ? (
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 border border-line-bright"
                      style={{ background: grupo.hex }}
                    />
                  ) : null}
                  <h3 className="font-display text-[12px] uppercase tracking-widest text-chalk">
                    {grupo.titulo}
                  </h3>
                  <span className="font-display text-[11px] text-chalk-faint">
                    {grupo.imagenes.length === 0
                      ? 'sin fotos'
                      : `${grupo.imagenes.length} ${grupo.imagenes.length === 1 ? 'foto' : 'fotos'}`}
                  </span>
                </div>

                {grupo.imagenes.length === 0 ? (
                  <p className="text-[12.5px] text-chalk-faint">
                    Elige este color arriba y sube las fotos, o arrastra hasta aquí una que ya esté.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {grupo.imagenes.map((image) => (
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

                          {/* Cambiar el archivo conserva el color, la posición
                              y si es la principal. */}
                          <div className="absolute inset-x-0 bottom-0 flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <label className="flex-1 cursor-pointer bg-ink/85 py-1.5 text-center font-display text-[9.5px] font-semibold uppercase tracking-widest text-chalk backdrop-blur hover:bg-ink">
                              {replacing === image.id ? 'Reemplazando…' : 'Reemplazar'}
                              <input
                                type="file"
                                accept="image/*,.heic,.heif"
                                className="sr-only"
                                onChange={(event) => void replace(image.id, event.target.files?.[0])}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setUrlFor(urlFor === image.id ? null : image.id)}
                              className="border-l border-line bg-ink/85 px-2.5 py-1.5 font-display text-[9.5px] font-semibold uppercase tracking-widest text-chalk backdrop-blur hover:bg-ink"
                            >
                              URL
                            </button>
                          </div>
                        </div>

                        {urlFor === image.id ? (
                          <div className="flex gap-1.5 border-t border-line p-2">
                            <input
                              type="url"
                              autoFocus
                              placeholder="https://…"
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  replaceFromUrl(image.id, event.currentTarget.value);
                                }
                              }}
                              className="h-8 min-w-0 flex-1 border border-line bg-ink-800 px-2 text-[11.5px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={(event) => {
                                const input = event.currentTarget.previousElementSibling as HTMLInputElement;
                                replaceFromUrl(image.id, input.value);
                              }}
                              className="h-8 shrink-0 border border-line-bright px-2 font-display text-[9.5px] font-semibold uppercase tracking-widest text-chalk hover:border-chalk"
                            >
                              Traer
                            </button>
                          </div>
                        ) : null}

                        <div className="space-y-1.5 p-2">
                          <label className="sr-only" htmlFor={`img-color-${image.id}`}>
                            Color de la foto
                          </label>
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
                              <option key={color.id} value={color.id}>
                                {colorLabel(color)}
                              </option>
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
                                if (confirm('¿Eliminar esta foto?')) {
                                  startTransition(async () => {
                                    await deleteProductImage(image.id);
                                    router.refresh();
                                  });
                                }
                              }}
                              aria-label="Eliminar foto"
                              className="text-chalk-faint hover:text-signal-bad"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 text-[13px] text-chalk-faint">
          Este producto todavía no tiene fotos.
        </p>
      )}
    </div>
  );
}
