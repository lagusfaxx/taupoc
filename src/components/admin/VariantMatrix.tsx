'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { addSize, removeSize, saveVariantMatrix, type AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface MatrixVariant {
  id: string;
  size: string;
  colorId: string;
  sku: string;
  stock: number;
  active: boolean;
  lowStockThreshold: number;
}

export interface MatrixColor {
  id: string;
  name: string;
  hex: string;
}

function Save({ dirty }: { dirty: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || dirty === 0}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-chalk-faint"
    >
      {pending ? 'Guardando…' : dirty === 0 ? 'Sin cambios' : `Guardar ${dirty} ${dirty === 1 ? 'cambio' : 'cambios'}`}
    </button>
  );
}

/**
 * Planilla de stock talla × color. Todo el inventario del producto en una
 * pantalla: es la vista que más se usa a diario, así que prioriza la edición
 * rápida con teclado por sobre cualquier adorno.
 */
export function VariantMatrix({
  productId,
  colors,
  sizes,
  variants,
}: {
  productId: string;
  colors: MatrixColor[];
  sizes: string[];
  variants: MatrixVariant[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<AdminState | null, FormData>(saveVariantMatrix, null);
  const [sizeState, sizeAction] = useActionState<AdminState | null, FormData>(addSize, null);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, { stock: v.stock, active: v.active }])),
    [variants],
  );
  const [values, setValues] = useState(initial);

  const cell = useMemo(() => {
    const map = new Map<string, MatrixVariant>();
    for (const v of variants) map.set(`${v.colorId}:${v.size}`, v);
    return map;
  }, [variants]);

  const dirty = Object.keys(values).filter(
    (id) => values[id].stock !== initial[id]?.stock || values[id].active !== initial[id]?.active,
  ).length;

  function update(id: string, patch: { stock?: number; active?: boolean }) {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  /** Aplica un valor a toda una fila (color) o a toda una columna (talla). */
  function fill(scope: { colorId?: string; size?: string }, value: number) {
    setValues((prev) => {
      const next = { ...prev };
      for (const v of variants) {
        if (scope.colorId && v.colorId !== scope.colorId) continue;
        if (scope.size && v.size !== scope.size) continue;
        next[v.id] = { ...next[v.id], stock: value };
      }
      return next;
    });
  }

  const totals = useMemo(() => {
    const byColor = new Map<string, number>();
    const bySize = new Map<string, number>();
    let total = 0;
    for (const v of variants) {
      const stock = values[v.id]?.stock ?? 0;
      if (!(values[v.id]?.active ?? v.active)) continue;
      byColor.set(v.colorId, (byColor.get(v.colorId) ?? 0) + stock);
      bySize.set(v.size, (bySize.get(v.size) ?? 0) + stock);
      total += stock;
    }
    return { byColor, bySize, total };
  }, [values, variants]);

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="productId" value={productId} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-chalk-dim">
              <strong className="text-chalk">{totals.total}</strong> unidades en stock ·{' '}
              {variants.length} SKU · {colors.length} colores × {sizes.length} tallas
            </p>
            <p className="mt-1 text-[12px] text-chalk-faint">
              Escribe el stock directamente en la celda. Usa los botones de fila y columna para
              rellenar en bloque.
            </p>
          </div>
          <Save dirty={dirty} />
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
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-line bg-ink-800 px-3 py-2.5 text-left font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
                  Color \ Talla
                </th>
                {sizes.map((size) => (
                  <th key={size} className="border-b border-line bg-ink-800 px-2 py-2 text-center">
                    <span className="block font-display text-[14px] font-bold text-chalk">{size}</span>
                    <span className="mt-0.5 block text-[10px] text-chalk-faint">
                      {totals.bySize.get(size) ?? 0} u.
                    </span>
                    <span className="mt-1 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => fill({ size }, 0)}
                        title={`Poner en cero la talla ${size}`}
                        className="px-1 font-display text-[9px] uppercase tracking-wide text-chalk-faint hover:text-signal-bad"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const value = Number(window.prompt(`Stock para toda la talla ${size}:`, '5'));
                          if (Number.isFinite(value) && value >= 0) fill({ size }, value);
                        }}
                        title={`Rellenar la talla ${size}`}
                        className="px-1 font-display text-[9px] uppercase tracking-wide text-chalk-faint hover:accent-text"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar la talla ${size} de todos los colores? Se pierde su stock.`)) {
                            startTransition(async () => {
                              await removeSize(productId, size);
                              router.refresh();
                            });
                          }
                        }}
                        title={`Eliminar la talla ${size}`}
                        className="px-1 text-chalk-faint hover:text-signal-bad"
                      >
                        <IconTrash className="h-3 w-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="border-b border-l border-line bg-ink-800 px-3 py-2.5 text-center font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color.id} className="hover:bg-ink-800/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-[190px] border-b border-r border-line bg-ink-900 px-3 py-2 text-left font-normal"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-4 w-4 shrink-0 border border-line-bright"
                        style={{ background: color.hex }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-chalk">{color.name}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => fill({ colorId: color.id }, 0)}
                          title={`Poner en cero ${color.name}`}
                          className="px-1 font-display text-[9px] uppercase text-chalk-faint hover:text-signal-bad"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const value = Number(window.prompt(`Stock para todas las tallas de ${color.name}:`, '5'));
                            if (Number.isFinite(value) && value >= 0) fill({ colorId: color.id }, value);
                          }}
                          title={`Rellenar ${color.name}`}
                          className="px-1 font-display text-[9px] uppercase text-chalk-faint hover:accent-text"
                        >
                          Set
                        </button>
                      </span>
                    </span>
                  </th>

                  {sizes.map((size) => {
                    const variant = cell.get(`${color.id}:${size}`);
                    if (!variant) {
                      return (
                        <td key={size} className="border-b border-line-soft bg-ink-800/40 px-2 py-2 text-center text-chalk-faint">
                          —
                        </td>
                      );
                    }
                    const value = values[variant.id];
                    const stock = value?.stock ?? 0;
                    const active = value?.active ?? variant.active;
                    const low = active && stock > 0 && stock <= variant.lowStockThreshold;
                    const out = active && stock === 0;

                    return (
                      <td key={size} className="border-b border-line-soft px-1 py-1 text-center">
                        <label className="sr-only" htmlFor={`stock-${variant.id}`}>
                          Stock {color.name} talla {size}
                        </label>
                        <input
                          id={`stock-${variant.id}`}
                          name={`stock:${variant.id}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={stock}
                          disabled={!active}
                          onChange={(e) => update(variant.id, { stock: Math.max(0, Number(e.target.value) || 0) })}
                          onFocus={(e) => e.currentTarget.select()}
                          title={variant.sku}
                          className={cn(
                            'h-9 w-full min-w-[52px] border bg-ink-900 text-center font-display text-[14px] font-semibold transition-colors focus:outline-none',
                            !active && 'border-line-soft text-chalk-faint/40 line-through',
                            active && out && 'border-signal-bad/50 bg-signal-bad/10 text-signal-bad',
                            active && low && 'border-signal-warn/50 bg-signal-warn/10 text-signal-warn',
                            active && !low && !out && 'border-line text-chalk focus:border-[var(--accent)]',
                          )}
                        />
                        <label className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-chalk-faint">
                          <input
                            type="checkbox"
                            name={`active:${variant.id}`}
                            checked={active}
                            onChange={(e) => update(variant.id, { active: e.target.checked })}
                            className="h-2.5 w-2.5 cursor-pointer appearance-none border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
                          />
                          <span className="sr-only">
                            SKU {variant.sku} activo
                          </span>
                          <span aria-hidden>{active ? 'on' : 'off'}</span>
                        </label>
                      </td>
                    );
                  })}

                  <td className="border-b border-l border-line-soft px-3 py-2 text-center font-display text-[14px] font-bold text-chalk">
                    {totals.byColor.get(color.id) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-chalk-faint">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-signal-bad/50 bg-signal-bad/20" aria-hidden /> Agotado
            </span>
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-signal-warn/50 bg-signal-warn/20" aria-hidden /> Stock bajo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-line-soft" aria-hidden /> SKU desactivado
            </span>
          </p>
          <Save dirty={dirty} />
        </div>
      </form>

      <form action={sizeAction} className="mt-6 flex flex-wrap items-end gap-2.5 border-t border-line pt-5">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <label htmlFor="new-size" className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Agregar talla
          </label>
          <input
            id="new-size"
            name="size"
            required
            placeholder="38"
            className="h-10 w-28 border border-line bg-ink-900 px-3 text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 border border-line-bright px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar a todos los colores
        </button>
        {sizeState ? (
          <p className={cn('text-[12.5px]', sizeState.ok ? 'text-signal-ok' : 'text-signal-bad')}>
            {sizeState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
