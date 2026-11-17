'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge rojo de oferta: solo el porcentaje. La talla va escrita al lado
 * ("Solo talla 22"), nunca se omite: un "−30%" suelto en la tarjeta haría
 * creer que todo el modelo está rebajado.
 */
export function SaleBadge({ percent, className }: { percent: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] bg-signal-sale px-2 py-1 font-display text-[9.5px] font-bold uppercase leading-none tracking-widest text-white',
        className,
      )}
    >
      −{percent}%
    </span>
  );
}

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * Cuenta regresiva hasta el fin de una oferta. Se pinta recién en el cliente:
 * en el servidor la hora no coincide con la del navegador y React se quejaría
 * del desfase de un segundo.
 */
export function SaleCountdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now == null) return null;
  const left = new Date(endsAt).getTime() - now;
  if (left <= 0) return <span className={className}>La oferta terminó</span>;
  const { d, h, m, s } = partes(left);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={cn('tabular-nums', className)}>
      Termina en {d > 0 ? `${d}d ` : ''}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
