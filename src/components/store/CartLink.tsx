'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconCart } from '@/components/ui/Icons';

/** Nombre del evento con el que una acción avisa el nuevo total del carrito. */
export const CART_EVENT = 'taupoc:carrito';

/** Avisa al encabezado sin pasar por el servidor. */
export function announceCart(count: number) {
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { count } }));
}

/**
 * Acceso al carrito con su contador.
 *
 * El número llega renderizado desde el servidor, pero además escucha el
 * resultado de agregar al carrito: el refresco del servidor a veces tarda o
 * llega de una respuesta ya cacheada, y entonces el contador se quedaba en
 * blanco hasta recargar la página aunque el producto sí estuviera dentro.
 */
export function CartLink({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  // Cuando el servidor vuelve a renderizar, su número manda.
  useEffect(() => setCount(initial), [initial]);

  useEffect(() => {
    const onCart = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === 'number') setCount(detail.count);
    };
    window.addEventListener(CART_EVENT, onCart);
    return () => window.removeEventListener(CART_EVENT, onCart);
  }, []);

  return (
    <Link
      href="/carrito"
      aria-label={`Carrito, ${count} ${count === 1 ? 'producto' : 'productos'}`}
      className="relative flex h-10 w-10 items-center justify-center text-chalk-dim transition-colors hover:text-chalk"
    >
      <IconCart className="h-[19px] w-[19px]" />
      {count > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center accent-bg px-1 font-display text-[10px] font-bold leading-none">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
