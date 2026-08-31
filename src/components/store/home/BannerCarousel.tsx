'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { mediaSrcSet } from '@/lib/media-url';
import { cn } from '@/lib/utils';

export interface BannerSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  ctaAltLabel?: string;
  ctaAltHref?: string;
  imageUrl: string | null;
  imageMobileUrl?: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

/**
 * Banner de una o varias láminas.
 *
 * Con una sola no hay temporizador ni controles: es una portada fija, y un
 * video en ese caso se repite en bucle. Con varias van pasando solas —las
 * fotos por tiempo, los videos cuando terminan, que es lo que se espera de un
 * video de diez segundos entre fotos— y quedan los puntos y las flechas para
 * moverse a mano.
 */
export function BannerCarousel({
  slides,
  intervalSec,
  overlay,
  fit,
  align,
  priority,
}: {
  slides: BannerSlide[];
  intervalSec: number;
  overlay: number;
  fit: string;
  align: string;
  priority: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Duración de la lámina de video en curso, cuando el navegador la conoce. */
  const [duracion, setDuracion] = useState(0);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const varias = slides.length > 1;

  const go = useCallback(
    (index: number) => setCurrent(((index % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  // Solo se reproduce la lámina visible: dejar los demás videos corriendo
  // detrás gasta datos y procesador sin que nadie los vea.
  useEffect(() => {
    setDuracion(0);
    videos.current.forEach((video, index) => {
      if (!video) return;
      if (index === current) void video.play().catch(() => undefined);
      else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [current]);

  useEffect(() => {
    if (!varias || paused) return;

    // Quien pidió menos movimiento no recibe un carrusel que avanza solo;
    // los controles siguen ahí.
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (quieto) return;

    // Un video marca su propio tiempo y avanza al terminar, no a mitad de una
    // toma. El temporizador sigue armado igual, más largo que el video, porque
    // uno que no llega a reproducirse —códec que el navegador no decodifica,
    // descarga que se corta— no avisa de ninguna manera, y sin esto el
    // carrusel se quedaría clavado en esa lámina para siempre.
    const segundos = slides[current].videoUrl
      ? (duracion > 0 ? duracion : Math.max(intervalSec, 8)) + 2
      : Math.max(2, intervalSec);

    const id = setTimeout(() => go(current + 1), segundos * 1000);
    return () => clearTimeout(id);
  }, [current, duracion, go, intervalSec, paused, slides, varias]);

  const alineacion =
    align === 'CENTRO'
      ? 'items-center text-center'
      : align === 'DERECHA'
        ? 'items-end text-right'
        : 'items-start text-left';

  const object = fit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          aria-hidden={index !== current}
          className={cn(
            'absolute inset-0 overflow-hidden transition-opacity duration-700 ease-tech',
            index === current ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {slide.videoUrl ? (
            <video
              ref={(element) => {
                videos.current[index] = element;
              }}
              muted
              playsInline
              // En bucle solo cuando es la única lámina: dentro de un carrusel
              // el final del video es lo que da paso a la siguiente.
              loop={!varias}
              autoPlay={index === 0}
              preload={index === 0 ? 'auto' : 'none'}
              poster={slide.posterUrl ?? slide.imageUrl ?? undefined}
              onLoadedMetadata={(event) => {
                if (index === current) setDuracion(event.currentTarget.duration || 0);
              }}
              onEnded={() => varias && go(current + 1)}
              className={cn('h-full w-full', object)}
            >
              <source src={slide.videoUrl} />
            </video>
          ) : slide.imageUrl ? (
            <picture>
              {slide.imageMobileUrl ? (
                <source
                  media="(max-width: 640px)"
                  srcSet={mediaSrcSet(slide.imageMobileUrl) ?? slide.imageMobileUrl}
                  sizes="100vw"
                />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                srcSet={mediaSrcSet(slide.imageUrl)}
                sizes="100vw"
                alt={slide.title}
                loading={priority && index === 0 ? 'eager' : 'lazy'}
                fetchPriority={priority && index === 0 ? 'high' : undefined}
                className={cn('h-full w-full', object)}
              />
            </picture>
          ) : null}

          <span
            aria-hidden
            className="absolute inset-0 bg-ink"
            style={{ opacity: Math.min(90, Math.max(0, overlay)) / 100 }}
          />

          <div className={cn('container relative flex h-full flex-col justify-center', alineacion)}>
            <div className="max-w-xl">
              {slide.eyebrow ? (
                <p className="font-display text-[10px] font-semibold uppercase tracking-mega text-chalk-faint">
                  {slide.eyebrow}
                </p>
              ) : null}
              {slide.title ? (
                <h2 className="mt-3 text-[32px] leading-[0.95] text-chalk lg:text-[46px]">
                  {slide.title}
                </h2>
              ) : null}
              {slide.subtitle ? (
                <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">{slide.subtitle}</p>
              ) : null}

              {slide.ctaLabel && slide.ctaHref ? (
                <div
                  className={cn(
                    'mt-7 flex flex-wrap gap-3',
                    align === 'CENTRO' && 'justify-center',
                    align === 'DERECHA' && 'justify-end',
                  )}
                >
                  <ButtonLink href={slide.ctaHref} size="lg">
                    {slide.ctaLabel}
                  </ButtonLink>
                  {slide.ctaAltLabel && slide.ctaAltHref ? (
                    <ButtonLink href={slide.ctaAltHref} size="lg" variant="outline">
                      {slide.ctaAltLabel}
                    </ButtonLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {varias ? (
        <>
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="Lámina anterior"
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-line-bright/40 bg-ink/40 text-chalk backdrop-blur transition-colors hover:bg-ink/70 lg:flex"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="Lámina siguiente"
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-line-bright/40 bg-ink/40 text-chalk backdrop-blur transition-colors hover:bg-ink/70 lg:flex"
          >
            ›
          </button>

          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(index)}
                aria-label={`Ir a la lámina ${index + 1}`}
                aria-current={index === current}
                className={cn(
                  'h-1.5 w-8 transition-colors',
                  index === current ? 'accent-bg' : 'bg-chalk/25 hover:bg-chalk/50',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
