'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Hero, type HeroData } from './Hero';

/**
 * Banners de la portada de taupoc.lat. El título principal (h1) de la página
 * no sale de acá: un banner puede no tener texto. Con uno solo se muestra tal cual; con
 * varios, se deslizan con el dedo (scroll-snap) y avanzan solos cada pocos
 * segundos, salvo que la persona los esté tocando o haya pedido reducir el
 * movimiento.
 */
export function HeroCarousel({ slides, intervalMs = 7000 }: { slides: (HeroData & { id: string })[]; intervalMs?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>([]);

  // En teléfono el texto va debajo de la foto: una diapositiva con texto es
  // más alta que una sin texto. El carrusel toma la altura de la que se ve,
  // para no dejar una franja vacía bajo la más corta.
  useEffect(() => {
    const els = slideRefs.current.filter(Boolean) as HTMLDivElement[];
    const measure = () => setHeights(els.map((el) => el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [slides.length]);

  // El índice sale de la posición del carrusel: funciona igual al deslizar.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, intervalMs);
    return () => clearInterval(t);
  }, [slides.length, paused, intervalMs]);

  if (slides.length === 1) return <Hero data={slides[0]} heading={false} />;

  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' });

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      aria-roledescription="carrusel"
    >
      <div
        ref={track}
        className="flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden transition-[height] duration-300 ease-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={heights[index] ? { height: heights[index] } : undefined}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="w-full shrink-0 snap-start"
            aria-hidden={i !== index}
          >
            <Hero data={slide} heading={false} />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-5 flex max-w-[1600px] gap-2 px-4 sm:px-8">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Banner ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            className="flex h-6 items-center"
          >
            <span className={cn('block h-[2px] w-8 transition-colors', i === index ? 'bg-graphite' : 'bg-hairline')} />
          </button>
        ))}
      </div>
    </div>
  );
}
