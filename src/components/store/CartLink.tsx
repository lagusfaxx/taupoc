'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconCart } from '@/components/ui/Icons';

/** Nombre del evento con el que una acción avisa el nuevo total del carrito. */
export const CART_EVENT = 'taupoc:carrito';

/** Marca del ícono del carrito en el encabezado, destino de la animación. */
const CART_TARGET = '[data-cart-target]';

export interface CartAnnounce {
  count?: number;
  /** Origen de la animación: la imagen que el cliente estaba mirando. */
  origin?: { x: number; y: number; width: number; height: number };
  imageUrl?: string | null;
}

/** Avisa al encabezado sin pasar por el servidor. */
export function announceCart(count: number, extra?: Omit<CartAnnounce, 'count'>) {
  window.dispatchEvent(new CustomEvent<CartAnnounce>(CART_EVENT, { detail: { count, ...extra } }));
}

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Lanza la miniatura del producto hacia el ícono del carrito.
 *
 * Es puro DOM: el vuelo cruza el árbol de React (de la ficha al encabezado) y
 * dura menos que cualquier re-render, así que montarlo como componente solo
 * agregaría estado que se descarta enseguida. Si el destino no está en
 * pantalla —o el visitante pidió menos movimiento— no hace nada y el badge
 * igual pulsa.
 */
export function flyToCart(source: {
  origin: { x: number; y: number; width: number; height: number };
  imageUrl?: string | null;
}) {
  if (typeof document === 'undefined' || reduceMotion()) return;
  const target = document.querySelector(CART_TARGET);
  if (!target || typeof Element.prototype.animate !== 'function') return;

  const to = target.getBoundingClientRect();
  const { origin, imageUrl } = source;

  const volador = document.createElement('div');
  volador.setAttribute('aria-hidden', 'true');
  volador.style.cssText = [
    'position:fixed',
    `left:${origin.x}px`,
    `top:${origin.y}px`,
    `width:${origin.width}px`,
    `height:${origin.height}px`,
    'z-index:80',
    'pointer-events:none',
    'border:1px solid rgba(244,246,248,.35)',
    'background:#12161A center/cover no-repeat',
    'will-change:transform,opacity',
  ].join(';');
  if (imageUrl) volador.style.backgroundImage = `url("${imageUrl}")`;
  document.body.appendChild(volador);

  // Escala final: el ancho del ícono sobre el de la miniatura.
  const escala = Math.max(0.08, to.width / Math.max(1, origin.width));
  const dx = to.x + to.width / 2 - (origin.x + origin.width / 2);
  const dy = to.y + to.height / 2 - (origin.y + origin.height / 2);

  const animacion = volador.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(${(1 + escala) / 2})`,
        opacity: 0.95,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${escala})`, opacity: 0.15, offset: 1 },
    ],
    { duration: 720, easing: 'cubic-bezier(.35,.85,.3,1)', fill: 'forwards' },
  );

  animacion.onfinish = () => volador.remove();
  animacion.oncancel = () => volador.remove();
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
  const [celebrando, setCelebrando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando el servidor vuelve a renderizar, su número manda.
  useEffect(() => setCount(initial), [initial]);

  useEffect(() => {
    const onCart = (event: Event) => {
      const detail = (event as CustomEvent<CartAnnounce>).detail;
      if (typeof detail?.count === 'number') setCount(detail.count);

      // El vuelo tarda ~720 ms; el ícono reacciona cuando la miniatura llega.
      const retardo = detail?.origin && !reduceMotion() ? 620 : 0;
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        setCelebrando(false);
        // Un cuadro apagado permite reiniciar la animación si se agrega dos
        // veces seguidas: sin esto la segunda vez no se vería nada.
        requestAnimationFrame(() => setCelebrando(true));
      }, retardo);
    };
    window.addEventListener(CART_EVENT, onCart);
    return () => {
      window.removeEventListener(CART_EVENT, onCart);
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  return (
    <Link
      href="/carrito"
      data-cart-target
      aria-label={`Carrito, ${count} ${count === 1 ? 'producto' : 'productos'}`}
      className="relative flex h-10 w-10 items-center justify-center text-chalk-dim transition-colors hover:text-chalk"
    >
      {celebrando ? (
        <span
          aria-hidden
          onAnimationEnd={() => setCelebrando(false)}
          className="pointer-events-none absolute inset-0 rounded-full border accent-border animate-cart-ring"
        />
      ) : null}

      <IconCart className={celebrando ? 'h-[19px] w-[19px] animate-cart-nudge' : 'h-[19px] w-[19px]'} />

      {count > 0 ? (
        <span
          key={celebrando ? `pop-${count}` : `idle-${count}`}
          className={cnBadge(celebrando)}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function cnBadge(celebrando: boolean) {
  return [
    'absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center',
    'accent-bg px-1 font-display text-[10px] font-bold leading-none',
    celebrando ? 'animate-cart-pop' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
