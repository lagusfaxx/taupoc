'use client';

import { useState, useTransition } from 'react';
import { addToCart } from '@/actions/cart';
import { cn } from '@/lib/utils';

/**
 * Tallas y botón de compra de la ficha de taupoc.lat. Usa la misma acción del
 * carrito que taupoc.cl: el stock y la reserva son los mismos.
 */
export function AddToCart({ sizes }: { sizes: { variantId: string; size: string; available: number }[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!selected) return;
    const fd = new FormData();
    fd.set('variantId', selected);
    fd.set('quantity', '1');
    start(async () => {
      const r = await addToCart(null, fd);
      setResult({ ok: r.ok, message: r.message });
    });
  }

  return (
    <div className="mt-10">
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
