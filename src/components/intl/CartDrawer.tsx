'use client';

import { useEffect, useRef, useState } from 'react';
import { formatUsdCents } from '@/lib/fx';
import { cn } from '@/lib/utils';

/** Lo que manda la ficha al agregar, para mostrarlo en el panel. */
export interface IntlAdded {
  name: string;
  color: string;
  size: string;
  priceCents: number | null;
  imageUrl: string | null;
  count: number;
}

export const INTL_ADDED_EVENT = 'taupoc:lat-agregado';

export function announceIntlAdded(item: IntlAdded) {
  window.dispatchEvent(new CustomEvent<IntlAdded>(INTL_ADDED_EVENT, { detail: item }));
}

/**
 * Panel "Agregado al carrito" de taupoc.lat. Entra por la derecha en
 * escritorio y sube desde abajo en teléfono, con el producto recién agregado
 * y los caminos siguientes: pagar, ver el carrito o seguir comprando.
 */
export function IntlCartDrawer() {
  const [item, setItem] = useState<IntlAdded | null>(null);
  const [open, setOpen] = useState(false);
  const payRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onAdded = (event: Event) => {
      setItem((event as CustomEvent<IntlAdded>).detail);
      // Se abre cuando la foto ya llegó al carrito.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => setOpen(true), reduce ? 0 : 450);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener(INTL_ADDED_EVENT, onAdded);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(INTL_ADDED_EVENT, onAdded);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (open) payRef.current?.focus();
  }, [open]);

  return (
    <div aria-hidden={!open} className={cn('fixed inset-0 z-[60]', open ? '' : 'pointer-events-none')}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className={cn('absolute inset-0 bg-black/25 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agregado al carrito"
        className={cn(
          'absolute bg-paper text-graphite transition-transform duration-300 ease-out',
          // Teléfono: hoja que sube desde abajo. Escritorio: panel a la derecha.
          'inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:px-8 sm:pt-8',
          open ? 'translate-x-0 translate-y-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0',
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-medium">Agregado al carrito</p>
          <button type="button" onClick={() => setOpen(false)} className="text-[15px] text-graphite-soft hover:text-graphite">
            Cerrar
          </button>
        </div>

        {item ? (
          <div className="mt-6 flex gap-4">
            <div className="relative h-28 w-24 shrink-0 bg-paper-soft">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              ) : null}
            </div>
            <div className="text-[15px]">
              <p className="font-medium">{item.name}</p>
              <p className="mt-0.5 text-graphite-soft">
                {item.color} · Talla {item.size}
              </p>
              {item.priceCents != null ? <p className="mt-2">{formatUsdCents(item.priceCents)}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <a
            ref={payRef}
            href="/checkout"
            className="flex h-14 items-center justify-center bg-cobalt text-[16px] font-medium text-white transition-colors hover:bg-cobalt-hover"
          >
            Pagar
          </a>
          <a href="/carrito" className="flex h-12 items-center justify-center text-[15px] text-graphite underline-offset-4 hover:underline">
            Ver carrito{item?.count ? ` (${item.count})` : ''}
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-12 w-full items-center justify-center text-[15px] text-graphite-soft hover:text-graphite"
          >
            Seguir comprando
          </button>
        </div>
      </div>
    </div>
  );
}
