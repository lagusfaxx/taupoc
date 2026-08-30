'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SizeChartRowData } from './SizeChart';

interface Chart {
  gender: 'MALE' | 'FEMALE' | 'UNISEX';
  label: string;
  rows: SizeChartRowData[];
}

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min} – ${max}`;
  return String(min ?? max);
}

export function SizeGuideTables({ charts }: { charts: Chart[] }) {
  const [active, setActive] = useState(0);
  const chart = charts[active];
  if (!chart) return null;

  const showChest = chart.rows.some((r) => r.chestMinCm != null);

  return (
    <div>
      {charts.length > 1 ? (
        <div className="mb-5 flex gap-1 border-b border-line" role="tablist">
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

      <div className="table-scroll">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
          <caption className="sr-only">Tabla de tallas {chart.label}</caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-line bg-ink-900 px-3 py-3 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Talla
              </th>
              {showChest ? <Th>Pecho</Th> : null}
              <Th>Cintura</Th>
              <Th>Cadera</Th>
              <Th>Estatura</Th>
              <Th>CN</Th>
              <Th>USA</Th>
              <Th>UK</Th>
              <Th>AUS</Th>
              <Th>NZ</Th>
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row) => (
              <tr key={row.size} className="group hover:bg-ink-800">
                <td className="sticky left-0 z-10 border-b border-line-soft bg-ink-900 px-3 py-3 font-display text-[16px] font-bold text-chalk group-hover:bg-ink-800">
                  {row.size}
                </td>
                {showChest ? <Td>{range(row.chestMinCm, row.chestMaxCm)}</Td> : null}
                <Td>{range(row.waistMinCm, row.waistMaxCm)}</Td>
                <Td>{range(row.hipMinCm, row.hipMaxCm)}</Td>
                <Td>{range(row.heightMinCm, row.heightMaxCm)}</Td>
                <Td muted>{row.cn ?? '—'}</Td>
                <Td muted>{row.usa ?? '—'}</Td>
                <Td muted>{row.uk ?? '—'}</Td>
                <Td muted>{row.aus ?? '—'}</Td>
                <Td muted>{row.nz ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12.5px] text-chalk-faint">
        Medidas en centímetros, tomadas sobre el cuerpo. Las columnas CN, USA, UK, AUS y NZ son
        equivalencias de talla de traje de competición, no de ropa de calle.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-line px-3 py-3 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td className={cn('border-b border-line-soft px-3 py-3', muted ? 'text-chalk-faint' : 'text-chalk-dim')}>
      {children}
    </td>
  );
}
