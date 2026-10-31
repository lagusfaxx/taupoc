'use client';

import { useTransition } from 'react';
import { removeCartItem, updateCartItem } from '@/actions/cart';

/**
 * Cantidad y quitar, en el carrito de taupoc.lat. Después de cada cambio la
 * página se recarga entera: así los totales y el encabezado salen del
 * servidor, sin depender de un refresco del router.
 */
export function CartQuantity({ itemId, quantity, max }: { itemId: string; quantity: number; max: number }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      window.location.reload();
    });

  return (
    <div className={`flex items-center gap-4 text-[15px] ${pending ? 'opacity-50' : ''}`}>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Quitar una unidad"
          disabled={pending || quantity <= 1}
          onClick={() => run(() => updateCartItem(itemId, quantity - 1))}
          className="h-9 w-9 text-graphite disabled:text-graphite-faint"
        >
          −
        </button>
        <span className="w-6 text-center tabular-nums">{quantity}</span>
        <button
          type="button"
          aria-label="Agregar una unidad"
          disabled={pending || quantity >= max}
          onClick={() => run(() => updateCartItem(itemId, quantity + 1))}
          className="h-9 w-9 text-graphite disabled:text-graphite-faint"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => removeCartItem(itemId))}
        className="text-graphite-soft underline-offset-4 hover:underline"
      >
        Quitar
      </button>
    </div>
  );
}
