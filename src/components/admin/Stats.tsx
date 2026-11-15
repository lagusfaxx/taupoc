import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Variación contra el período anterior. `invert` cuando subir es malo. */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) {
    return <span className="text-[11.5px] text-chalk-faint">Sin base para comparar</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : invert ? value < 0 : value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[12px] font-medium',
        good == null ? 'text-chalk-faint' : good ? 'text-signal-ok' : 'text-signal-bad',
      )}
    >
      <span aria-hidden>{flat ? '→' : value > 0 ? '▲' : '▼'}</span>
      {value > 0 ? '+' : ''}
      {value.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%
      <span className="font-normal text-chalk-faint">vs. período anterior</span>
    </span>
  );
}

/** Línea mínima de tendencia dentro de una tarjeta. */
export function Spark({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...values);
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${((i * w) / (values.length - 1)).toFixed(1)} ${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-8 w-[120px]', className)} aria-hidden preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  delta,
  invert,
  hint,
  spark,
  showDelta = true,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
  hint?: ReactNode;
  spark?: number[];
  showDelta?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col border border-line bg-ink-900 p-5">
      <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">{label}</p>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="font-display text-[28px] font-bold leading-none tracking-tight text-chalk">{value}</p>
        {spark ? <Spark values={spark} className="shrink-0" /> : null}
      </div>
      {showDelta ? (
        <p className="mt-3">
          <Delta value={delta ?? null} invert={invert} />
        </p>
      ) : null}
      {hint ? <p className="mt-1.5 text-[12px] leading-relaxed text-chalk-faint">{hint}</p> : null}
    </div>
  );
}

export interface FunnelStep {
  label: string;
  value: number;
  /** Texto bajo la etapa: qué significa o qué revisar. */
  hint?: string;
}

/**
 * Embudo en barras horizontales. Cada etapa muestra cuántos pasaron desde la
 * anterior, que es el número que dice dónde se pierde la venta.
 */
export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="space-y-3.5">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const pass = prev ? Math.round((step.value / prev) * 1000) / 10 : null;
        return (
          <li key={step.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-chalk">{step.label}</span>
              <span className="flex items-baseline gap-2.5">
                {pass != null ? (
                  <span className="text-[11.5px] text-chalk-faint">
                    {pass.toLocaleString('es-CL')}% de la etapa anterior
                  </span>
                ) : null}
                <span className="font-display text-[16px] font-bold tabular-nums text-chalk">
                  {step.value.toLocaleString('es-CL')}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full bg-ink-700" title={`${step.label}: ${step.value.toLocaleString('es-CL')}`}>
              <div
                className="h-full rounded-r-[3px] accent-bg"
                style={{ width: `${Math.max(step.value > 0 ? 1.5 : 0, (step.value / top) * 100)}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
            {step.hint ? <p className="mt-1 text-[11.5px] text-chalk-faint">{step.hint}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Valor ya formateado, a la derecha. */
  display: string;
  sub?: string;
}

/** Ranking en barras de un solo tono: la magnitud la da el largo. */
export function BarList({ rows, empty = 'Sin datos en el período.', labelWidth = 'w-28' }: {
  rows: BarRow[];
  empty?: string;
  labelWidth?: string;
}) {
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return <p className="text-[13px] text-chalk-faint">{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3" title={`${typeof row.label === 'string' ? row.label : row.key}: ${row.display}`}>
          <span className={cn('shrink-0 truncate text-[13px] text-chalk-dim', labelWidth)}>{row.label}</span>
          <span className="h-2.5 min-w-0 flex-1 bg-ink-700">
            <span className="block h-full rounded-r-[3px] accent-bg" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="shrink-0 text-right text-[13px] tabular-nums text-chalk">
            {row.display}
            {row.sub ? <span className="ml-1.5 text-[11.5px] text-chalk-faint">{row.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Una tarea pendiente del día: número, qué es y adónde ir a resolverla. */
export function ActionItem({
  href,
  count,
  label,
  detail,
  tone = 'warn',
}: {
  href: string;
  count: number | string;
  label: string;
  detail?: string;
  tone?: 'warn' | 'bad' | 'info';
}) {
  const dot = tone === 'bad' ? 'bg-signal-bad' : tone === 'info' ? 'bg-signal-info' : 'bg-signal-warn';
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 border-b border-line-soft px-5 py-3.5 transition-colors last:border-b-0 hover:bg-ink-800"
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
      <span className="w-10 shrink-0 font-display text-[20px] font-bold leading-none tabular-nums text-chalk">{count}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-chalk">{label}</span>
        {detail ? <span className="block text-[12px] text-chalk-faint">{detail}</span> : null}
      </span>
      <span aria-hidden className="text-chalk-faint transition-transform group-hover:translate-x-1 group-hover:text-chalk">→</span>
    </Link>
  );
}

/** Lectura en una frase de qué dice el dato y qué hacer con él. */
export function Insight({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-l-2 border-line-bright pl-3 text-[12.5px] leading-relaxed text-chalk-dim">{children}</p>
  );
}
