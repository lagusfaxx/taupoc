'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveMenu } from '@/actions/admin/menu';
import type { AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconChevron, IconPlus, IconTrash } from '@/components/ui/Icons';

export interface MenuChildRow {
  label: string;
  href: string;
  note: string;
  active: boolean;
}

export interface MenuRow extends MenuChildRow {
  children: MenuChildRow[];
}

const EMPTY_CHILD: MenuChildRow = { label: '', href: '', note: '', active: true };
const EMPTY_ITEM: MenuRow = { ...EMPTY_CHILD, children: [] };

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
      {pending ? 'Guardando…' : 'Guardar menú'}
    </button>
  );
}

function MoverYBorrar({
  onUp,
  onDown,
  onDelete,
  etiqueta,
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  etiqueta: string;
}) {
  const boton =
    'flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-line-bright hover:text-chalk';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onUp} aria-label={`Subir ${etiqueta}`} className={boton}>
        <IconChevron className="h-3.5 w-3.5 rotate-180" />
      </button>
      <button type="button" onClick={onDown} aria-label={`Bajar ${etiqueta}`} className={boton}>
        <IconChevron className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Eliminar ${etiqueta}`}
        className="flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-signal-bad hover:text-signal-bad"
      >
        <IconTrash className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Activo({
  checked,
  onChange,
  etiqueta,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <label className="flex h-9 shrink-0 items-center gap-2 text-[12.5px] text-chalk-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`Mostrar ${etiqueta}`}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      Visible
    </label>
  );
}

function mover<T>(rows: T[], index: number, delta: number): T[] {
  const destino = index + delta;
  if (destino < 0 || destino >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[destino]] = [next[destino]!, next[index]!];
  return next;
}

/**
 * El editor del menú de la tienda.
 *
 * Cada fila de primer nivel es un enlace del encabezado; sus hijos son las
 * entradas del desplegable. El orden de las filas es el orden en pantalla, y
 * un enlace sin hijos simplemente no abre desplegable.
 */
export function MenuManager({
  items,
  suggestions,
  guardado,
}: {
  items: MenuRow[];
  /** Destinos que existen en la tienda, para no tener que escribirlos. */
  suggestions: { label: string; href: string }[];
  /** Si lo que se muestra ya está guardado o es todavía el menú por defecto. */
  guardado: boolean;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveMenu, null);
  const [rows, setRows] = useState<MenuRow[]>(items.length ? items : [EMPTY_ITEM]);

  function actualizar(index: number, patch: Partial<MenuRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function actualizarHijo(index: number, hijo: number, patch: Partial<MenuChildRow>) {
    setRows((r) =>
      r.map((row, i) =>
        i === index
          ? { ...row, children: row.children.map((c, j) => (j === hijo ? { ...c, ...patch } : c)) }
          : row,
      ),
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="menu" value={JSON.stringify(rows)} />

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

      {!guardado ? (
        <p className="border border-line bg-ink-900 px-3.5 py-2.5 text-[13px] text-chalk-dim">
          Este es el menú por defecto, armado con las líneas del catálogo. Al guardar pasa a ser el
          tuyo y deja de cambiar solo. Si borras todas las filas y guardas, la tienda vuelve al menú
          por defecto.
        </p>
      ) : null}

      <ul className="space-y-4">
        {rows.map((row, i) => (
          <li key={i} className="border border-line bg-ink-900">
            <div className="flex flex-wrap items-end gap-3 border-b border-line-soft p-4">
              <div className="min-w-40 flex-1">
                <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                  Texto
                </label>
                <input
                  value={row.label}
                  onChange={(e) => actualizar(i, { label: e.target.value })}
                  maxLength={60}
                  placeholder="Competición"
                  aria-label={`Texto del enlace ${i + 1}`}
                  className={input}
                />
              </div>

              <div className="min-w-56 flex-[2]">
                <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                  Destino
                </label>
                <input
                  value={row.href}
                  onChange={(e) => actualizar(i, { href: e.target.value })}
                  list="destinos-menu"
                  placeholder="/catalogo"
                  aria-label={`Destino del enlace ${i + 1}`}
                  className={input}
                />
              </div>

              <Activo
                checked={row.active}
                onChange={(v) => actualizar(i, { active: v })}
                etiqueta={row.label || `enlace ${i + 1}`}
              />

              <MoverYBorrar
                etiqueta={row.label || `enlace ${i + 1}`}
                onUp={() => setRows((r) => mover(r, i, -1))}
                onDown={() => setRows((r) => mover(r, i, 1))}
                onDelete={() => setRows((r) => r.filter((_, index) => index !== i))}
              />
            </div>

            <div className="p-4">
              <p className="mb-2.5 font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Desplegable {row.children.length === 0 ? '— sin entradas' : ''}
              </p>

              <ul className="space-y-2">
                {row.children.map((child, j) => (
                  <li key={j} className="flex flex-wrap items-center gap-2">
                    <input
                      value={child.label}
                      onChange={(e) => actualizarHijo(i, j, { label: e.target.value })}
                      maxLength={60}
                      placeholder="Hombre — Jammers"
                      aria-label={`Texto de la entrada ${j + 1} de ${row.label || `enlace ${i + 1}`}`}
                      className={cn(input, 'min-w-36 flex-1')}
                    />
                    <input
                      value={child.href}
                      onChange={(e) => actualizarHijo(i, j, { href: e.target.value })}
                      list="destinos-menu"
                      placeholder="/catalogo?genero=MALE"
                      aria-label={`Destino de la entrada ${j + 1}`}
                      className={cn(input, 'min-w-48 flex-1')}
                    />
                    <input
                      value={child.note}
                      onChange={(e) => actualizarHijo(i, j, { note: e.target.value })}
                      maxLength={120}
                      placeholder="Nota (opcional)"
                      aria-label={`Nota de la entrada ${j + 1}`}
                      className={cn(input, 'min-w-40 flex-1')}
                    />
                    <Activo
                      checked={child.active}
                      onChange={(v) => actualizarHijo(i, j, { active: v })}
                      etiqueta={child.label || `entrada ${j + 1}`}
                    />
                    <MoverYBorrar
                      etiqueta={child.label || `entrada ${j + 1}`}
                      onUp={() => actualizar(i, { children: mover(row.children, j, -1) })}
                      onDown={() => actualizar(i, { children: mover(row.children, j, 1) })}
                      onDelete={() =>
                        actualizar(i, { children: row.children.filter((_, index) => index !== j) })
                      }
                    />
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => actualizar(i, { children: [...row.children, EMPTY_CHILD] })}
                className="mt-3 inline-flex h-9 items-center gap-2 border border-line px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
              >
                <IconPlus className="h-3.5 w-3.5" />
                Agregar entrada
              </button>
            </div>
          </li>
        ))}
      </ul>

      <datalist id="destinos-menu">
        {suggestions.map((s) => (
          <option key={s.href} value={s.href}>
            {s.label}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { ...EMPTY_ITEM, children: [] }])}
          className="inline-flex h-10 items-center gap-2 border border-line px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar enlace
        </button>
        <Save />
      </div>
    </form>
  );
}
