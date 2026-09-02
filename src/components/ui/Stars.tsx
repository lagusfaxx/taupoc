import { cn } from '@/lib/utils';

const TAMANOS = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const;

/**
 * Estrellas de calificación.
 *
 * El relleno parcial se hace recortando una copia de la fila con `width`,
 * no redondeando a media estrella: así un 4,3 se ve distinto de un 4,5, que
 * es justo la diferencia que el cliente compara entre dos productos.
 *
 * Es decorativo: el número va al lado en texto, y ahí es donde los lectores
 * de pantalla leen la nota.
 */
export function Stars({
  value,
  size = 'md',
  className,
}: {
  value: number;
  size?: keyof typeof TAMANOS;
  className?: string;
}) {
  const porcentaje = Math.max(0, Math.min(100, (value / 5) * 100));
  const clase = TAMANOS[size];

  return (
    <span className={cn('relative inline-flex shrink-0 align-middle', className)} aria-hidden>
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Estrella key={i} className={cn(clase, 'text-line-bright')} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${porcentaje}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Estrella key={i} className={cn(clase, 'shrink-0 accent-text')} />
        ))}
      </span>
    </span>
  );
}

function Estrella({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 1.6l2.47 5.28 5.53.75-4.03 3.85 1.02 5.72L10 14.48l-4.99 2.72 1.02-5.72L2 7.63l5.53-.75z" />
    </svg>
  );
}

/** Estrellas + nota + total, el bloque que se repite en tarjetas y ficha. */
export function RatingSummary({
  average,
  count,
  size = 'sm',
  className,
}: {
  average: number;
  count: number;
  size?: keyof typeof TAMANOS;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Stars value={average} size={size} />
      <span className="text-[12.5px] text-chalk-dim">
        {average.toFixed(1).replace('.', ',')}
        <span className="text-chalk-faint"> ({count})</span>
      </span>
    </span>
  );
}
