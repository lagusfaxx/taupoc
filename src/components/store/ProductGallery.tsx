'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
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

  const tira = useRef<HTMLDivElement>(null);

  // Al cambiar de color cambia el set de imágenes: siempre volver a la primera.
  useEffect(() => {
    setIndex(0);
    tira.current?.scrollTo({ left: 0 });
  }, [colorName]);

  /** En el teléfono las fotos se pasan deslizando; el índice sigue al dedo. */
  function alDeslizar() {
    const el = tira.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(images.length - 1, i)));
  }

  function irA(i: number) {
    setIndex(i);
    const el = tira.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

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
    <>
    {/* Teléfono: fotos a todo el ancho que se pasan deslizando. El alto se
        limita para que el nombre y el precio asomen en la primera pantalla,
        justo debajo de la foto. */}
    <div className="relative lg:hidden">
      <div
        ref={tira}
        onScroll={alDeslizar}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory overflow-x-auto bg-[#EFEFED]"
      >
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setZoom(true);
            }}
            aria-label={`Ampliar imagen ${i + 1} de ${images.length}`}
            data-fly-source={i === index ? '' : undefined}
            className="relative h-[min(100vw,50svh)] w-full shrink-0 snap-center"
          >
            <Image
              src={image.url}
              alt={image.alt || `${productName} — ${colorName}`}
              fill
              priority={i === 0}
              sizes="100vw"
              // Las fotos vienen sobre blanco: multiply lo funde con el gris
              // del cuadro, igual que en las tarjetas del catálogo.
              className="object-contain mix-blend-multiply"
            />
          </button>
        ))}
      </div>

      {images.length > 1 ? (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/70 px-2 backdrop-blur" role="tablist" aria-label="Imágenes del producto">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              onClick={() => irA(i)}
              className="flex h-5 items-center px-0.5"
            >
              <span className={cn('block h-1 rounded-full transition-all', i === index ? 'w-5 bg-chalk' : 'w-2 bg-chalk/40')} />
            </button>
          ))}
        </div>
      ) : null}
    </div>

    <div className="hidden gap-4 lg:flex">
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
        data-fly-source
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
    </>
  );
}
