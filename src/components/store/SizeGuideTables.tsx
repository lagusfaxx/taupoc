'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SizeChartRowData } from './SizeChart';

interface Chart {
  gender: 'MALE' | 'FEMALE' | 'UNISEX';
  label: string;
  rows: SizeChartRowData[];
}

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  return String(min ?? max);
}

function mid(min: number | null, max: number | null): number | null {
  if (min == null || max == null) return null;
  return (min + max) / 2;
}

/** Fila cuyo rango queda más cerca de las medidas ingresadas. */
function closest(rows: SizeChartRowData[], m: { chest?: number; waist?: number; hip?: number }) {
  let best: { size: string; d: number } | null = null;
  for (const row of rows) {
    const pairs = [
      [m.chest, mid(row.chestMinCm, row.chestMaxCm)],
      [m.waist, mid(row.waistMinCm, row.waistMaxCm)],
      [m.hip, mid(row.hipMinCm, row.hipMaxCm)],
    ].filter(([v, t]) => v != null && t != null) as [number, number][];
    if (pairs.length === 0) continue;
    const d = pairs.reduce((s, [v, t]) => s + Math.abs(v - t) / t, 0) / pairs.length;
    if (!best || d < best.d) best = { size: row.size, d };
  }
  return best?.size ?? null;
}

export function SizeGuideTables({ charts }: { charts: Chart[] }) {
  const [active, setActive] = useState(0);
  const [values, setValues] = useState({ chest: '', waist: '', hip: '' });
  const chart = charts[active];

  const showChest = chart?.rows.some((r) => r.chestMinCm != null) ?? false;
  const showHip = chart?.rows.some((r) => r.hipMinCm != null) ?? false;
  const showEquiv = chart?.rows.some((r) => r.usa || r.uk || r.aus || r.nz || r.cn) ?? false;

  const match = useMemo(() => {
    if (!chart) return null;
    const num = (v: string) => (v.trim() ? Number(v) : undefined);
    const m = {
      chest: showChest ? num(values.chest) : undefined,
      waist: num(values.waist),
      hip: showHip ? num(values.hip) : undefined,
    };
    if (!m.chest && !m.waist && !m.hip) return null;
    return closest(chart.rows, m);
  }, [chart, values, showChest, showHip]);

  if (!chart) return null;

  const inputs = [
    showChest ? { key: 'chest' as const, label: 'Pecho', placeholder: '88' } : null,
    { key: 'waist' as const, label: 'Cintura', placeholder: '76' },
    showHip ? { key: 'hip' as const, label: 'Cadera', placeholder: '92' } : null,
  ].filter(Boolean) as { key: 'chest' | 'waist' | 'hip'; label: string; placeholder: string }[];

  return (
    <div>
      {charts.length > 1 ? (
        <div className="mb-6 flex gap-1 border-b border-line" role="tablist">
          {charts.map((c, i) => (
            <button
              key={c.gender}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                '-mb-px border-b-2 px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors',
                i === active ? 'accent-border accent-text' : 'border-transparent text-chalk-faint hover:text-chalk',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        {inputs.map((input) => (
          <label key={input.key} className="block w-28">
            <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
              {input.label} (cm)
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={values[input.key]}
              onChange={(e) => setValues((v) => ({ ...v, [input.key]: e.target.value }))}
              placeholder={input.placeholder}
              className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[16px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none sm:text-[15px]"
            />
          </label>
        ))}
        <p className="pb-2.5 text-[14px] text-chalk-dim" aria-live="polite">
          {match ? (
            <>
              Tu talla: <strong className="font-display text-[18px] accent-text">{match}</strong>
            </>
          ) : (
            'Escribe tus medidas y marcamos tu talla.'
          )}
        </p>
      </div>

      <div className="table-scroll">
        <table className="w-full min-w-[560px] border-collapse text-[14px]">
          <caption className="sr-only">Tabla de tallas {chart.label}</caption>
          <thead>
            <tr className="text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
              <th rowSpan={2} className="sticky left-0 z-10 border-b border-line bg-ink-900 px-3 py-3 align-bottom">
                Talla
              </th>
              <th
                colSpan={2 + Number(showChest) + Number(showHip)}
                className="border-b border-line-soft px-3 pb-1.5 pt-3 text-chalk-dim"
              >
                Tu cuerpo · cm
              </th>
              {showEquiv ? (
                <th colSpan={4} className="border-b border-l border-line-soft px-3 pb-1.5 pt-3 text-chalk-dim">
                  Equivale a
                </th>
              ) : null}
            </tr>
            <tr className="text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
              {showChest ? <Th>Pecho</Th> : null}
              <Th>Cintura</Th>
              {showHip ? <Th>Cadera</Th> : null}
              <Th>Estatura</Th>
              {showEquiv ? (
                <>
                  <Th className="border-l border-line-soft">USA</Th>
                  <Th>UK</Th>
                  <Th>AUS</Th>
                  <Th>NZ</Th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, i) => {
              const hit = row.size === match;
              return (
                <tr
                  key={row.size}
                  aria-current={hit ? 'true' : undefined}
                  className={cn(hit ? 'bg-ink-800' : i % 2 === 1 && 'bg-ink-900/40')}
                >
                  <td
                    className={cn(
                      'sticky left-0 z-10 border-b border-line-soft px-3 py-3 font-display text-[17px] font-bold',
                      hit ? 'bg-ink-800 accent-text' : 'bg-ink-900 text-chalk',
                    )}
                  >
                    {row.size}
                  </td>
                  {showChest ? <Td strong={hit}>{range(row.chestMinCm, row.chestMaxCm)}</Td> : null}
                  <Td strong={hit}>{range(row.waistMinCm, row.waistMaxCm)}</Td>
                  {showHip ? <Td strong={hit}>{range(row.hipMinCm, row.hipMaxCm)}</Td> : null}
                  <Td strong={hit}>{range(row.heightMinCm, row.heightMaxCm)}</Td>
                  {showEquiv ? (
                    <>
                      <Td muted className="border-l border-line-soft">{row.usa ?? '—'}</Td>
                      <Td muted>{row.uk ?? '—'}</Td>
                      <Td muted>{row.aus ?? '—'}</Td>
                      <Td muted>{row.nz ?? '—'}</Td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[13px] text-chalk-faint">
        La talla de la tabla es la que compras. Si quedas entre dos, escríbenos y te confirmamos.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('border-b border-line px-3 pb-3 pt-1.5', className)}>{children}</th>;
}

function Td({
  children,
  muted,
  strong,
  className,
}: {
  children: React.ReactNode;
  muted?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'whitespace-nowrap border-b border-line-soft px-3 py-3 tabular-nums',
        strong ? 'text-chalk' : muted ? 'text-chalk-faint' : 'text-chalk-dim',
        className,
      )}
    >
      {children}
    </td>
  );
}
