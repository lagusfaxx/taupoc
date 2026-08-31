'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { IconClose } from '@/components/ui/Icons';

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export function ProductGallery({
  images,
  colorName,
  productName,
}: {
  images: GalleryImage[];
  colorName: string;
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [montado, setMontado] = useState(false);

  // El portal necesita el document, que en el servidor no existe.
  useEffect(() => setMontado(true), []);

  // Al cambiar de color cambia el set de imágenes: siempre volver a la primera.
  useEffect(() => setIndex(0), [colorName]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, images.length]);

  if (images.length === 0) {
    return <div className="aspect-[4/5] w-full border border-line bg-ink-800" />;
  }

  const active = images[Math.min(index, images.length - 1)];

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row lg:gap-4">
      {images.length > 1 ? (
        <div
          className="no-scrollbar flex gap-2.5 overflow-x-auto lg:w-[76px] lg:shrink-0 lg:flex-col lg:overflow-visible"
          role="tablist"
          aria-label="Imágenes del producto"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              onClick={() => setIndex(i)}
              className={cn(
                'relative aspect-[4/5] w-[62px] shrink-0 overflow-hidden border transition-all lg:w-full',
                i === index ? 'accent-border' : 'border-line hover:border-line-bright',
              )}
            >
              <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="Ampliar imagen"
        className="group relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden border border-line bg-ink-800"
      >
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt || `${productName} — ${colorName}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 46vw"
          className="object-cover animate-rise-in"
        />
        <span className="absolute bottom-3 right-3 border border-line-bright bg-ink/80 px-2 py-1 font-display text-[10px] uppercase tracking-widest text-chalk-dim opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          Ampliar
        </span>
      </button>

      {zoom && montado ? (
        // La ampliación se monta colgando de <body>: la columna de la galería
        // es sticky, y eso abre un contexto de apilamiento propio del que el
        // z-index no sale. Dentro de él la imagen quedaba por debajo de los
        // botones de talla de la columna siguiente.
        createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/95"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Cerrar"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center border border-line text-chalk"
          >
            <IconClose className="h-5 w-5" />
          </button>

          <div className="relative h-[86vh] w-[92vw] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={active.url}
              alt={active.alt}
              fill
              sizes="92vw"
              className="object-contain"
            />
          </div>

          {images.length > 1 ? (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" onClick={(e) => e.stopPropagation()}>
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Imagen ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn('h-1.5 w-8 transition-colors', i === index ? 'accent-bg' : 'bg-line-bright')}
                />
              ))}
            </div>
          ) : null}
        </div>,
        document.body,
        )
      ) : null}
    </div>
  );
}
