'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';
import { IconClose } from '@/components/ui/Icons';

export interface Facets {
  lines: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  colors: { slug: string; name: string; hex: string }[];
  sizes: { size: string; inStock: boolean }[];
  minPrice: number;
  maxPrice: number;
}

const GENDERS = [
  { value: 'MALE', label: 'Hombre' },
  { value: 'FEMALE', label: 'Mujer' },
];

const SORTS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nuevos', label: 'Más nuevos' },
  { value: 'nombre', label: 'Nombre A–Z' },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-6 first:pt-0 last:border-0">
      <h3 className="eyebrow mb-4">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Envoltorio del catálogo: barra de orden arriba, panel de filtros al costado
 * y la grilla de productos (renderizada en el servidor) como children.
 * Todo el estado vive en la URL, así los filtros son compartibles y navegables.
 */
export function CatalogShell({
  facets,
  resultCount,
  children,
}: {
  facets: Facets;
  resultCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const push = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
      push(next);
    },
    [params, push],
  );

  /** Los filtros multivalor viajan como lista separada por comas. */
  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      const current = (next.get(key) ?? '').split(',').filter(Boolean);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length) next.set(key, updated.join(','));
      else next.delete(key);
      push(next);
    },
    [params, push],
  );

  const has = (key: string, value: string) =>
    (params.get(key) ?? '').split(',').filter(Boolean).includes(value);

  const activeCount =
    ['genero', 'linea', 'tallas', 'colores', 'precio_min', 'precio_max', 'stock', 'q'].filter((k) =>
      params.get(k),
    ).length;

  const clearAll = () => {
    const next = new URLSearchParams();
    const sort = params.get('orden');
    if (sort) next.set('orden', sort);
    push(next);
  };

  const panel = (
    <div className={cn('transition-opacity', pending && 'opacity-50')}>
      <Group title="Género">
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => {
            const active = params.get('genero') === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => setParam('genero', active ? null : g.value)}
                aria-pressed={active}
                className={cn(
                  'border px-3.5 py-2 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors',
                  active
                    ? 'accent-border accent-text bg-ink-800'
                    : 'border-line text-chalk-dim hover:border-line-bright hover:text-chalk',
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </Group>

      {facets.lines.length > 0 ? (
        <Group title="Línea">
          <div className="flex flex-wrap gap-2">
            {facets.lines.map((line) => {
              const active = params.get('linea') === line.slug;
              return (
                <button
                  key={line.slug}
                  type="button"
                  onClick={() => setParam('linea', active ? null : line.slug)}
                  aria-pressed={active}
                  className={cn(
                    'border px-3.5 py-2 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors',
                    active
                      ? 'accent-border accent-text bg-ink-800'
                      : 'border-line text-chalk-dim hover:border-line-bright hover:text-chalk',
                  )}
                >
                  {line.name}
                </button>
              );
            })}
          </div>
        </Group>
      ) : null}

      <Group title="Talla">
        <div className="grid grid-cols-5 gap-1.5">
          {facets.sizes.map(({ size, inStock }) => {
            const active = has('tallas', size);
            // Una talla sin stock solo se puede tocar si ya está filtrando,
            // para poder quitarla.
            const disabled = !inStock && !active;
            return (
              <button
                key={size}
                type="button"
                disabled={disabled}
                onClick={() => toggleMulti('tallas', size)}
                aria-pressed={active}
                title={inStock ? undefined : `Talla ${size} sin stock`}
                className={cn(
                  'relative border py-2 font-display text-[12px] font-semibold tracking-wide transition-colors',
                  active && 'accent-border accent-text bg-ink-800',
                  !active && inStock && 'border-line text-chalk-dim hover:border-line-bright hover:text-chalk',
                  disabled && 'cursor-not-allowed border-line-soft text-chalk-faint/40',
                )}
              >
                {size}
                {disabled ? (
                  <span
                    className="absolute inset-x-1.5 top-1/2 h-px -translate-y-1/2 rotate-[-18deg] bg-line-bright"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <a
          href="/guia-de-tallas"
          className="mt-3 inline-block text-[12px] text-chalk-faint underline underline-offset-2 hover:text-chalk"
        >
          Guía de tallas
        </a>
      </Group>

      <Group title="Color">
        <div className="flex flex-wrap gap-2">
          {facets.colors.map((color) => {
            const active = has('colores', color.slug);
            return (
              <button
                key={color.slug}
                type="button"
                onClick={() => toggleMulti('colores', color.slug)}
                aria-pressed={active}
                title={color.name}
                aria-label={color.name}
                className={cn(
                  'h-8 w-8 border-2 transition-all',
                  active ? 'border-chalk' : 'border-line hover:border-chalk-faint',
                )}
                style={{ background: color.hex }}
              />
            );
          })}
        </div>
      </Group>

      <Group title="Precio">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={params.get('precio_min') ?? ''}
            placeholder={String(facets.minPrice)}
            aria-label="Precio mínimo"
            onBlur={(e) => setParam('precio_min', e.target.value || null)}
            className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[14px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
          />
          <span className="text-chalk-faint">–</span>
          <input
            type="number"
            inputMode="numeric"
            defaultValue={params.get('precio_max') ?? ''}
            placeholder={String(facets.maxPrice)}
            aria-label="Precio máximo"
            onBlur={(e) => setParam('precio_max', e.target.value || null)}
            className="w-full border border-line bg-ink-900 px-3 py-2.5 text-[14px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <p className="mt-2.5 text-[12px] text-chalk-faint">
          Catálogo entre {formatCLP(facets.minPrice)} y {formatCLP(facets.maxPrice)}
        </p>
      </Group>

      <Group title="Disponibilidad">
        <label className="flex cursor-pointer items-center gap-3 text-[14px] text-chalk-dim">
          <input
            type="checkbox"
            checked={params.get('stock') === '1'}
            onChange={(e) => setParam('stock', e.target.checked ? '1' : null)}
            className="h-4 w-4 cursor-pointer appearance-none border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
          />
          Solo con stock disponible
        </label>
      </Group>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="mt-5 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-faint hover:text-chalk"
        >
          <IconClose className="h-3.5 w-3.5" />
          Limpiar filtros ({activeCount})
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Barra de control: resultado, orden y acceso a filtros en móvil. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="text-[13px] text-chalk-faint" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'producto' : 'productos'}
          {activeCount > 0 ? ` · ${activeCount} ${activeCount === 1 ? 'filtro' : 'filtros'}` : ''}
        </p>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="shrink-0 border border-line px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk lg:hidden"
          >
            Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>

          <label className="relative flex min-w-0 items-center">
            <span className="sr-only">Ordenar por</span>
            <select
              value={params.get('orden') ?? 'destacados'}
              onChange={(e) => setParam('orden', e.target.value === 'destacados' ? null : e.target.value)}
              className="w-full min-w-0 appearance-none truncate border border-line bg-ink-900 py-2 pl-3 pr-9 text-[13px] text-chalk focus:border-[var(--accent)] focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden
              viewBox="0 0 12 8"
              className="pointer-events-none absolute right-3 h-2 w-3 fill-none stroke-chalk-faint stroke-[1.6]"
            >
              <path d="M1 1.5 6 6.5 11 1.5" />
            </svg>
          </label>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[248px_1fr] lg:gap-14">
        <aside aria-label="Filtros" className="hidden lg:block">
          {panel}
        </aside>
        <div>{children}</div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-[90%] max-w-sm flex-col border-l border-line bg-ink-900">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
              <h2 className="font-display text-sm uppercase tracking-widest text-chalk">Filtros</h2>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar filtros" className="text-chalk-dim">
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{panel}</div>
            <div className="shrink-0 border-t border-line p-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-full accent-bg py-3.5 font-display text-[12px] font-semibold uppercase tracking-widest"
              >
                Ver {resultCount} {resultCount === 1 ? 'producto' : 'productos'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
