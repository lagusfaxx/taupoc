'use client';

import { useState, useTransition } from 'react';
import { addToCart } from '@/actions/cart';
import { announceCart, flyToCart } from '@/components/store/CartLink';
import { announceIntlAdded } from './CartDrawer';
import { cn } from '@/lib/utils';

/**
 * Tallas y botón de compra de la ficha de taupoc.lat. Usa la misma acción del
 * carrito que taupoc.cl: el stock y la reserva son los mismos.
 */
export function AddToCart({
  sizes,
  product,
}: {
  sizes: { variantId: string; size: string; available: number; priceCents?: number | null }[];
  /** Para el panel de confirmación y el vuelo de la foto al carrito. */
  product: { name: string; color: string; imageUrl: string | null };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!selected) return;
    const fd = new FormData();
    fd.set('variantId', selected);
    fd.set('quantity', '1');
    const size = sizes.find((s) => s.variantId === selected);
    start(async () => {
      const r = await addToCart(null, fd);
      if (!r.ok) {
        setResult({ ok: false, message: r.message });
        return;
      }
      setResult(null);
      // La foto visible vuela hasta "Carrito", el contador salta y se abre
      // el panel con lo agregado: la misma respuesta que en taupoc.cl.
      const photo = [...document.querySelectorAll<HTMLElement>('[data-gallery-main]')].find((el) => el.offsetParent);
      const rect = photo?.getBoundingClientRect();
      const origin = rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined;
      const count = typeof r.count === 'number' ? r.count : undefined;
      if (origin) flyToCart({ origin, imageUrl: product.imageUrl });
      announceCart(count ?? 0, { origin, imageUrl: product.imageUrl });
      announceIntlAdded({
        name: product.name,
        color: product.color,
        size: size?.size ?? '',
        priceCents: size?.priceCents ?? null,
        imageUrl: product.imageUrl,
        count: count ?? 0,
      });
    });
  }

  return (
    <div className="mt-6 lg:mt-10">
      <p className="text-[13px] text-graphite-soft">Talla</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {sizes.map((s) => {
          const out = s.available <= 0;
          return (
            <li key={s.variantId}>
              <button
                type="button"
                disabled={out}
                onClick={() => {
                  setSelected(s.variantId);
                  setResult(null);
                }}
                aria-pressed={selected === s.variantId}
                aria-label={`Talla ${s.size}${out ? ', agotada' : ''}`}
                className={cn(
                  'h-11 min-w-11 px-3 text-[16px] transition-colors',
                  out
                    ? 'cursor-not-allowed text-graphite-faint line-through'
                    : selected === s.variantId
                      ? 'bg-graphite text-white'
                      : 'text-graphite hover:bg-paper-soft',
                )}
              >
                {s.size}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={add}
        disabled={!selected || pending}
        className="mt-6 h-14 w-full bg-cobalt text-[16px] font-medium text-white transition-colors hover:bg-cobalt-hover disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-graphite-faint"
      >
        {pending ? 'Agregando…' : selected ? 'Agregar al carrito' : 'Elige tu talla'}
      </button>

      {result ? (
        <p role={result.ok ? 'status' : 'alert'} className="mt-4 text-[15px] text-graphite">
          {result.message}{' '}
          {result.ok ? (
            // Carga completa: el encabezado vuelve con el carrito al día.
            <a href="/carrito" className="text-cobalt underline underline-offset-4">
              Ver carrito
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
