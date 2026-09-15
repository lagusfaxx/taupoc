'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveCategories } from '@/actions/admin/categories';
import type { AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconChevron, IconPlus, IconTrash } from '@/components/ui/Icons';

export interface CategoryRow {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  /** Cuántos productos la usan. Solo informativo: no se edita acá. */
  products: number;
}

const EMPTY: CategoryRow = { id: null, name: '', slug: '', description: '', active: true, products: 0 };

const input =
  'h-9 w-full border border-line bg-ink-900 px-2.5 text-[13px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar categorías'}
    </button>
  );
}

/**
 * Las categorías del catálogo: nombre, dirección y orden.
 *
 * El orden de las filas es el que ve el visitante en los filtros y el que se
 * ofrece al armar el menú. Una categoría con productos no se puede borrar
 * desde acá: se desactiva, y el servidor rechaza el borrado si igual se
 * intenta.
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveCategories, null);
  const [rows, setRows] = useState<CategoryRow[]>(categories.length ? categories : [EMPTY]);

  function actualizar(index: number, patch: Partial<CategoryRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function mover(index: number, delta: number) {
    setRows((r) => {
      const destino = index + delta;
      if (destino < 0 || destino >= r.length) return r;
      const next = [...r];
      [next[index], next[destino]] = [next[destino]!, next[index]!];
      return next;
    });
  }

  return (
    <form action={action} className="space-y-5">
      <input
        type="hidden"
        name="categorias"
        value={JSON.stringify(
          rows.map(({ id, name, slug, description, active }) => ({
            id,
            name,
            slug,
            description,
            active,
          })),
        )}
      />

      {state ? (
        <p
          role="status"
          className={cn(
            'border px-3.5 py-2.5 text-[13px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.id ?? `nueva-${i}`} className="flex flex-wrap items-end gap-2 border border-line bg-ink-900 p-3">
            <div className="min-w-36 flex-1">
              <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Nombre
              </label>
              <input
                value={row.name}
                onChange={(e) => actualizar(i, { name: e.target.value })}
                maxLength={60}
                placeholder="Competición Hombre"
                aria-label={`Nombre de la categoría ${i + 1}`}
                className={input}
              />
            </div>

            <div className="min-w-36 flex-1">
              <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Dirección
              </label>
              <input
                value={row.slug}
                onChange={(e) => actualizar(i, { slug: e.target.value })}
                maxLength={80}
                placeholder="se genera del nombre"
                aria-label={`Dirección de la categoría ${i + 1}`}
                className={input}
              />
            </div>

            <div className="min-w-48 flex-[2]">
              <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Descripción
              </label>
              <input
                value={row.description}
                onChange={(e) => actualizar(i, { description: e.target.value })}
                maxLength={200}
                placeholder="Jammers homologados World Aquatics."
                aria-label={`Descripción de la categoría ${i + 1}`}
                className={input}
              />
            </div>

            <label className="flex h-9 shrink-0 items-center gap-2 text-[12.5px] text-chalk-dim">
              <input
                type="checkbox"
                checked={row.active}
                onChange={(e) => actualizar(i, { active: e.target.checked })}
                aria-label={`Mostrar ${row.name || `categoría ${i + 1}`}`}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Visible
            </label>

            <span className="flex h-9 shrink-0 items-center text-[12px] text-chalk-faint">
              {row.products} {row.products === 1 ? 'producto' : 'productos'}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => mover(i, -1)}
                aria-label={`Subir ${row.name || `categoría ${i + 1}`}`}
                className="flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-line-bright hover:text-chalk"
              >
                <IconChevron className="h-3.5 w-3.5 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                aria-label={`Bajar ${row.name || `categoría ${i + 1}`}`}
                className="flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-line-bright hover:text-chalk"
              >
                <IconChevron className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={row.products > 0}
                onClick={() => setRows((r) => r.filter((_, index) => index !== i))}
                aria-label={`Eliminar ${row.name || `categoría ${i + 1}`}`}
                title={row.products > 0 ? 'Tiene productos: muévelos antes de borrarla.' : undefined}
                className="flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-signal-bad hover:text-signal-bad disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-chalk-faint"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, EMPTY])}
          className="inline-flex h-10 items-center gap-2 border border-line px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar categoría
        </button>
        <Save />
      </div>
    </form>
  );
}
