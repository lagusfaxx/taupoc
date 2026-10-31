'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Fotos de la ficha de taupoc.lat.
 *
 * En escritorio, todas a lo ancho de la columna, una debajo de otra, con la
 * información fija al lado. En teléfono eso empujaba tallas y colores muy
 * abajo: ahí va una foto grande y una fila de miniaturas que la cambian.
 */
export function ProductGallery({ images, fallbackAlt }: { images: GalleryImage[]; fallbackAlt: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  if (!current) return null;

  return (
    <>
      {/* Teléfono y tablet */}
      <div className="lg:hidden">
        <div className="relative aspect-[5/4] bg-paper">
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt || fallbackAlt}
            fill
            priority={active === 0}
            sizes="100vw"
            className="object-contain"
          />
        </div>
        {images.length > 1 ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Fotos">
            {images.map((image, i) => (
              <li key={image.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Foto ${i + 1}`}
                  aria-current={i === active ? 'true' : undefined}
                  className={cn(
                    'relative block h-16 w-16 bg-paper-soft',
                    i === active ? 'ring-1 ring-graphite' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  <Image src={image.url} alt="" fill sizes="64px" className="object-contain" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Escritorio */}
      <div className="hidden space-y-4 lg:block">
        {images.map((image, i) => (
          <div key={image.url} className="relative aspect-[4/5] bg-paper">
            <Image
              src={image.url}
              alt={image.alt || fallbackAlt}
              fill
              priority={i === 0}
              sizes="60vw"
              className="object-contain"
            />
          </div>
        ))}
      </div>
    </>
  );
}
