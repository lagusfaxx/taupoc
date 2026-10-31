'use client';

import { useEffect, useState } from 'react';
import { CART_EVENT, type CartAnnounce } from '@/components/store/CartLink';
import { cn } from '@/lib/utils';

/**
 * "Carrito (n)" del encabezado de taupoc.lat. Es el destino del vuelo de la
 * foto al agregar (data-cart-target) y el número cambia al instante, con un
 * pequeño salto, sin esperar al servidor. Mismo aviso que en taupoc.cl.
 */
export function IntlCartLink({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const [pop, setPop] = useState(0);

  useEffect(() => setCount(initial), [initial]);

  useEffect(() => {
    const onCart = (event: Event) => {
      const detail = (event as CustomEvent<CartAnnounce>).detail;
      if (typeof detail?.count === 'number') setCount(detail.count);
      // El vuelo de la foto tarda ~720 ms: el contador salta cuando llega.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => setPop((n) => n + 1), detail?.origin && !reduce ? 620 : 0);
    };
    window.addEventListener(CART_EVENT, onCart);
    return () => window.removeEventListener(CART_EVENT, onCart);
  }, []);

  return (
    <a
      href="/carrito"
      data-cart-target
      aria-label={`Carrito, ${count} ${count === 1 ? 'producto' : 'productos'}`}
      className="inline-flex items-center underline-offset-[6px] hover:underline"
    >
      Carrito
      {count > 0 ? (
        <span key={pop} className={cn('ml-1 inline-block tabular-nums', pop > 0 && 'animate-cart-pop')}>
          ({count})
        </span>
      ) : null}
    </a>
  );
}
