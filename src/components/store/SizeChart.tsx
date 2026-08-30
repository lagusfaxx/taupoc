'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { IconClose, IconRuler } from '@/components/ui/Icons';

export interface SizeChartRowData {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  cn: string | null;
  usa: string | null;
  uk: string | null;
  aus: string | null;
  nz: string | null;
}

type Tab = 'medidas' | 'equivalencias';

function range(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min} – ${max}`;
  return String(min ?? max);
}

function mid(min: number | null, max: number | null): number | null {
  if (min == null || max == null) return null;
  return (min + max) / 2;
}

/**
 * Buscador de talla. Toma las medidas del nadador y devuelve la talla de
 * cuerpo más cercana, y luego la talla de competencia aplicando el descuento
 * de compresión. Es el punto de mayor fricción del rubro: si acá se equivocan,
 * vuelve el producto.
 */
function findSize(rows: SizeChartRowData[], measures: { chest?: number; waist?: number; hip?: number }) {
  const scored = rows
    .map((row) => {
      const targets: [number | undefined, number | null][] = [
        [measures.chest, mid(row.chestMinCm, row.chestMaxCm)],
        [measures.waist, mid(row.waistMinCm, row.waistMaxCm)],
        [measures.hip, mid(row.hipMinCm, row.hipMaxCm)],
      ];
      const used = targets.filter(([v, t]) => v != null && t != null) as [number, number][];
      if (used.length === 0) return null;
      // Distancia media normalizada respecto del centro de cada rango.
      const distance = used.reduce((sum, [value, target]) => sum + Math.abs(value - target) / target, 0) / used.length;
      return { row, distance };
    })
    .filter(Boolean) as { row: SizeChartRowData; distance: number }[];

  if (scored.length === 0) return null;
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].row;
}

export function SizeChart({
  rows,
  gender,
  fitNotes,
  fitOffset = 1,
  productName,
  onPickSize,
}: {
  rows: SizeChartRowData[];
  gender: 'MALE' | 'FEMALE' | 'UNISEX';
  fitNotes?: string | null;
  fitOffset?: number;
  productName: string;
  onPickSize?: (size: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('medidas');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');

  const showChest = gender !== 'MALE' && rows.some((r) => r.chestMinCm != null);

  const suggestion = useMemo(() => {
    const measures = {
      chest: showChest && chest ? Number(chest) : undefined,
      waist: waist ? Number(waist) : undefined,
      hip: hip ? Number(hip) : undefined,
    };
    if (!measures.chest && !measures.waist && !measures.hip) return null;

    const bodyRow = findSize(rows, measures);
    if (!bodyRow) return null;

    const index = rows.findIndex((r) => r.size === bodyRow.size);
    const raceIndex = Math.max(0, index - fitOffset);
    const sprintIndex = Math.max(0, index - fitOffset - 1);

    return {
      body: bodyRow.size,
      race: rows[raceIndex]?.size ?? bodyRow.size,
      sprint: rows[sprintIndex]?.size ?? rows[raceIndex]?.size ?? bodyRow.size,
    };
  }, [chest, waist, hip, rows, showChest, fitOffset]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim underline underline-offset-4 transition-colors hover:accent-text"
      >
        <IconRuler className="h-4 w-4" />
        Tabla de tallas
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Tabla de tallas"
        >
          <div className="absolute inset-0 bg-ink/88 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />

          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col border border-line bg-ink-900 shadow-lift animate-rise-in sm:max-h-[86vh]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="eyebrow-accent mb-1.5">Guía de tallas</p>
                <h2 className="font-display text-lg tracking-tight text-chalk">{productName}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-chalk-faint hover:text-chalk">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {/* Nota de calce: la información más importante de esta ventana. */}
              <div className="mb-6 border-l-2 accent-border bg-ink-800 px-4 py-3.5">
                <p className="font-display text-[11px] font-semibold uppercase tracking-widest accent-text">
                  Cómo se usa un traje de competición
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">
                  {fitNotes ??
                    'Los trajes de competición se usan 1 a 2 tallas por debajo de la talla habitual: esa tensión es la que genera la compresión.'}
                </p>
              </div>

              {/* Calculadora de talla */}
              <div className="mb-7 surface p-5">
                <h3 className="font-display text-[13px] uppercase tracking-widest text-chalk">
                  Encuentra tu talla
                </h3>
                <p className="mt-1.5 text-[13px] text-chalk-faint">
                  Ingresa las medidas del cuerpo en centímetros, sin apretar la huincha.
                </p>

                <div className={cn('mt-4 grid gap-3', showChest ? 'grid-cols-3' : 'grid-cols-2')}>
                  {showChest ? (
                    <label className="block">
                      <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                        Pecho (cm)
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={chest}
                        onChange={(e) => setChest(e.target.value)}
                        placeholder="88"
                        className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[15px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                      Cintura (cm)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="76"
                      className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[15px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                      Cadera (cm)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={hip}
                      onChange={(e) => setHip(e.target.value)}
                      placeholder="90"
                      className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[15px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                </div>

                {suggestion ? (
                  <div className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
                    {[
                      { label: 'Talla de cuerpo', value: suggestion.body, note: 'Sin compresión' },
                      { label: 'Fondo · 400 m+', value: suggestion.race, note: 'Compresión moderada' },
                      { label: 'Velocidad · 50–200 m', value: suggestion.sprint, note: 'Compresión máxima' },
                    ].map((item, i) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (i > 0 && onPickSize) {
                            onPickSize(item.value);
                            setOpen(false);
                          }
                        }}
                        disabled={i === 0 || !onPickSize}
                        className={cn(
                          'bg-ink-800 px-4 py-4 text-left transition-colors',
                          i > 0 && onPickSize && 'hover:bg-ink-700',
                          i === 0 && 'opacity-70',
                        )}
                      >
                        <p className="font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                          {item.label}
                        </p>
                        <p
                          className={cn(
                            'mt-1.5 font-display text-3xl font-bold tracking-tight',
                            i === 0 ? 'text-chalk-dim' : 'accent-text',
                          )}
                        >
                          {item.value}
                        </p>
                        <p className="mt-1 text-[12px] text-chalk-faint">
                          {i > 0 && onPickSize ? 'Seleccionar esta talla' : item.note}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-[13px] text-chalk-faint">
                    Completa al menos una medida para ver la talla sugerida.
                  </p>
                )}
              </div>

              {/* Tablas */}
              <div className="mb-4 flex gap-1 border-b border-line">
                {(
                  [
                    ['medidas', 'Medidas del cuerpo'],
                    ['equivalencias', 'Equivalencias internacionales'],
                  ] as [Tab, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    aria-selected={tab === value}
                    className={cn(
                      '-mb-px border-b-2 px-3 py-2.5 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors',
                      tab === value
                        ? 'accent-border accent-text'
                        : 'border-transparent text-chalk-faint hover:text-chalk',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="table-scroll">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border-b border-line bg-ink-900 px-3 py-2.5 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                        Talla
                      </th>
                      {tab === 'medidas' ? (
                        <>
                          {showChest ? <Th>Pecho (cm)</Th> : null}
                          <Th>Cintura (cm)</Th>
                          <Th>Cadera (cm)</Th>
                          <Th>Estatura (cm)</Th>
                        </>
                      ) : (
                        <>
                          <Th>CN</Th>
                          <Th>USA</Th>
                          <Th>UK</Th>
                          <Th>AUS</Th>
                          <Th>NZ</Th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.size} className="group hover:bg-ink-800">
                        <td className="sticky left-0 z-10 border-b border-line-soft bg-ink-900 px-3 py-2.5 font-display text-[15px] font-bold text-chalk group-hover:bg-ink-800">
                          {row.size}
                        </td>
                        {tab === 'medidas' ? (
                          <>
                            {showChest ? <Td>{range(row.chestMinCm, row.chestMaxCm)}</Td> : null}
                            <Td>{range(row.waistMinCm, row.waistMaxCm)}</Td>
                            <Td>{range(row.hipMinCm, row.hipMaxCm)}</Td>
                            <Td>{range(row.heightMinCm, row.heightMaxCm)}</Td>
                          </>
                        ) : (
                          <>
                            <Td>{row.cn ?? '—'}</Td>
                            <Td>{row.usa ?? '—'}</Td>
                            <Td>{row.uk ?? '—'}</Td>
                            <Td>{row.aus ?? '—'}</Td>
                            <Td>{row.nz ?? '—'}</Td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-5 text-[12.5px] leading-relaxed text-chalk-faint">
                Las medidas corresponden al cuerpo del nadador, no a la prenda. Si tus medidas caen entre
                dos tallas, elige la menor. Ante cualquier duda escríbenos por WhatsApp con las medidas
                y te confirmamos la talla exacta antes de despachar.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-line px-3 py-2.5 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-line-soft px-3 py-2.5 text-chalk-dim">{children}</td>;
}
