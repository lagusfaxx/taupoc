import { cn } from '@/lib/utils';

/**
 * Separador con forma de andarivel.
 *
 * Es la cuerda de flotadores que divide los carriles de la piscina: el guiño
 * más directo a la natación que se puede meter sin ensuciar la página, y
 * ocupa el lugar que ya tenían las líneas divisorias entre secciones.
 *
 * Los discos derivan lentos hacia un lado, como cuando alguien acaba de
 * pasar nadando. El bloque global de `prefers-reduced-motion` en
 * `globals.css` deja la cuerda quieta para quien pidió menos movimiento.
 */
export function LaneDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('relative h-6 w-full overflow-hidden border-y border-line-soft bg-ink-900', className)}
    >
      {/* Dos capas porque son dos animaciones: la de afuera cabecea, la de
          adentro corre. Combinarlas en un solo elemento obligaría a componer
          ambas en la misma propiedad `transform`. */}
      <span className="absolute inset-0 animate-ondear">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <span className="absolute inset-0 andarivel animate-deriva opacity-80" />
      </span>
      {/* Los extremos se desvanecen para que la cuerda no choque con el borde. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-900 to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-900 to-transparent" />
    </div>
  );
}
