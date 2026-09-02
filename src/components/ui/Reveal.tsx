'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Saca el contenido a flote cuando entra en pantalla.
 *
 * Dos cuidados que evitan los dos defectos habituales de este patrón:
 *
 *  1. El HTML del servidor sale visible. Ocultar de entrada dejaría la
 *     página en blanco si el script no llega, y a los buscadores les
 *     mostraría contenido invisible.
 *  2. Lo que ya está en pantalla al montar no se anima: si no, todo lo de
 *     la primera pantalla parpadea al hidratar, que es justo lo contrario
 *     de lo que se busca.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Retardo en milisegundos, para escalonar elementos hermanos. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 'quieto' es distinto de 'animando': lo que ya estaba en pantalla se
  // queda como está, sin reproducir la entrada.
  const [estado, setEstado] = useState<'servidor' | 'esperando' | 'animando' | 'quieto'>('servidor');

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    const sinMovimiento =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento || typeof IntersectionObserver === 'undefined') {
      setEstado('quieto');
      return;
    }

    // Ya visible al montar: se deja como está, sin animación ni parpadeo.
    const caja = nodo.getBoundingClientRect();
    if (caja.top < window.innerHeight * 0.9) {
      setEstado('quieto');
      return;
    }

    setEstado('esperando');
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setEstado('animando');
        observador.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        estado === 'esperando' && 'opacity-0',
        estado === 'animando' && 'animate-emerger',
        className,
      )}
      style={estado === 'animando' && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
