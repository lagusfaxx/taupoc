'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSizeDeals, type AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { formatCLP } from '@/lib/money';
import { applyPercent, DEFAULT_SCARCITY_FROM, MAX_SALE_PERCENT } from '@/lib/variant-price';

export interface SizeDealRow {
  size: string;
  /** Unidades vendibles sumando todos los colores activos. */
  available: number;
  /** Lo mínimo que tiene un color con stock: el badge se decide por color. */
  minColorAvailable: number;
  /** Precio normal de la talla (el más común entre sus colores). */
  regular: number;
  salePercent: number | null;
  /** ISO o null. */
  saleEndsAt: string | null;
  scarcityFrom: number | null;
}

interface RowValue {
  pct: string;
  /** Valor de `<input type="datetime-local">`, en la hora del navegador. */
  ends: string;
  scar: string;
}

/** ISO → "AAAA-MM-DDTHH:MM" en la hora local del navegador. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function Save({ dirty }: { dirty: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || dirty === 0}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-chalk-faint"
    >
      {pending ? 'Guardando…' : dirty === 0 ? 'Sin cambios' : `Guardar ${dirty} ${dirty === 1 ? 'talla' : 'tallas'}`}
    </button>
  );
}

/**
 * Ofertas por talla del modelo. Sirve para mover una talla que se quedó
 * quieta (la 36 que nadie compra) sin rebajar el modelo entero, y para
 * decidir desde cuántas unidades la tienda grita "Quedan solo N".
 */
export function SizeDeals({ productId, rows }: { productId: string; rows: SizeDealRow[] }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveSizeDeals, null);

  const initial = useMemo(
    () =>
      Object.fromEntries(
        rows.map((r) => [
          r.size,
          {
            pct: r.salePercent ? String(r.salePercent) : '',
            ends: toLocalInput(r.saleEndsAt),
            scar: r.scarcityFrom == null ? '' : String(r.scarcityFrom),
          } satisfies RowValue,
        ]),
      ) as Record<string, RowValue>,
    [rows],
  );
  const [values, setValues] = useState(initial);

  const dirtySizes = rows
    .map((r) => r.size)
    .filter((s) => {
      const a = values[s];
      const b = initial[s];
      return a.pct !== b.pct || a.ends !== b.ends || a.scar !== b.scar;
    });

  function update(size: string, patch: Partial<RowValue>) {
    setValues((prev) => ({ ...prev, [size]: { ...prev[size], ...patch } }));
  }

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-[12.5px] leading-relaxed text-chalk-faint">
          El descuento se aplica a esa talla en todos los colores y la tienda lo muestra con un badge
          <strong className="text-chalk"> “−X% en talla N”</strong> en la tarjeta y en la ficha, con cuenta
          regresiva si le pones término. Al vencer, la talla vuelve sola a su precio normal. “Quedan
          pocas” muestra <strong className="text-chalk">“¡Quedan solo N!”</strong> cuando el stock real
          de un color baja de ese número (vacío = {DEFAULT_SCARCITY_FROM}, 0 = nunca). Los cupones no se
          aplican a las tallas en oferta: es oferta o cupón.
        </p>
        <Save dirty={dirtySizes.length} />
      </div>

      {state ? (
        <p
          role="status"
          className={cn(
            'mb-4 border px-3.5 py-2.5 text-[13px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <div className="overflow-x-auto border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-ink-800 text-left font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
              <th className="border-b border-line px-3 py-2.5">Talla</th>
              <th className="border-b border-line px-3 py-2.5">Stock total</th>
              <th className="border-b border-line px-3 py-2.5">Descuento %</th>
              <th className="border-b border-line px-3 py-2.5">Precio</th>
              <th className="border-b border-line px-3 py-2.5">Termina</th>
              <th className="border-b border-line px-3 py-2.5">Quedan pocas desde</th>
              <th className="border-b border-line px-3 py-2.5">En la tienda</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = values[r.size];
              const pct = Number(v.pct) || 0;
              const valid = pct > 0 && pct <= MAX_SALE_PERCENT;
              const endsMs = v.ends ? new Date(v.ends).getTime() : null;
              const expired = valid && endsMs != null && endsMs <= Date.now();
              const scar = v.scar === '' ? DEFAULT_SCARCITY_FROM : Number(v.scar) || 0;
              // La tienda decide "quedan pocas" por color, no con la suma.
              const scarce = r.minColorAvailable > 0 && r.minColorAvailable <= scar;
              const dirty = dirtySizes.includes(r.size);
              return (
                <tr key={r.size} className={cn('hover:bg-ink-800/40', dirty && 'bg-ink-800/30')}>
                  <td className="border-b border-line-soft px-3 py-2 font-display text-[15px] font-bold text-chalk">
                    {r.size}
                    {/* Solo las tallas tocadas viajan: así una fila vencida que
                        nadie editó no bloquea el guardado de las demás. */}
                    {dirty ? (
                      <>
                        <input type="hidden" name={`pct:${r.size}`} value={v.pct} />
                        <input type="hidden" name={`ends:${r.size}`} value={toIso(v.ends)} />
                        <input type="hidden" name={`scar:${r.size}`} value={v.scar} />
                      </>
                    ) : null}
                  </td>
                  <td className={cn('border-b border-line-soft px-3 py-2', r.available === 0 ? 'text-chalk-faint' : 'text-chalk')}>
                    {r.available} u.
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={MAX_SALE_PERCENT}
                      inputMode="numeric"
                      placeholder="—"
                      value={v.pct}
                      onChange={(e) => update(r.size, { pct: e.target.value })}
                      aria-label={`Descuento talla ${r.size}`}
                      className="h-9 w-20 border border-line bg-ink-900 px-2 text-center font-display text-[14px] font-semibold text-chalk focus:border-[var(--accent)] focus:outline-none"
                    />
                  </td>
                  <td className="border-b border-line-soft px-3 py-2 whitespace-nowrap">
                    {valid ? (
                      <>
                        <span className="font-semibold text-chalk">{formatCLP(applyPercent(r.regular, pct))}</span>{' '}
                        <s className="text-[12px] text-chalk-faint">{formatCLP(r.regular)}</s>
                      </>
                    ) : (
                      <span className="text-chalk-dim">{formatCLP(r.regular)}</span>
                    )}
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="datetime-local"
                        value={v.ends}
                        disabled={!valid}
                        onChange={(e) => update(r.size, { ends: e.target.value })}
                        aria-label={`Término de la oferta talla ${r.size}`}
                        className="h-9 border border-line bg-ink-900 px-2 text-[12.5px] text-chalk focus:border-[var(--accent)] focus:outline-none disabled:opacity-40"
                      />
                      {v.ends && valid ? (
                        <button
                          type="button"
                          onClick={() => update(r.size, { ends: '' })}
                          className="text-[11px] text-chalk-faint hover:text-signal-bad"
                          title="Sin fecha de término"
                        >
                          ✕
                        </button>
                      ) : null}
                    </span>
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      inputMode="numeric"
                      placeholder={String(DEFAULT_SCARCITY_FROM)}
                      value={v.scar}
                      onChange={(e) => update(r.size, { scar: e.target.value })}
                      aria-label={`Quedan pocas desde, talla ${r.size}`}
                      className="h-9 w-16 border border-line bg-ink-900 px-2 text-center font-display text-[14px] font-semibold text-chalk focus:border-[var(--accent)] focus:outline-none"
                    />
                  </td>
                  <td className="border-b border-line-soft px-3 py-2">
                    <span className="flex flex-wrap gap-1.5">
                      {valid && !expired ? (
                        <span className="rounded-[3px] bg-signal-bad px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-white">
                          −{pct}% talla {r.size}
                        </span>
                      ) : null}
                      {expired ? <span className="text-[11.5px] text-signal-bad">Fecha ya pasada</span> : null}
                      {scarce ? (
                        <span className="rounded-[3px] bg-signal-warn/20 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-signal-warn">
                          Quedan pocas
                        </span>
                      ) : null}
                      {!valid && !scarce ? <span className="text-chalk-faint">—</span> : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Save dirty={dirtySizes.length} />
      </div>
    </form>
  );
}
