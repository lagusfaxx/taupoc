import { Fragment } from 'react';
import Link from 'next/link';
import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { LineComparisonColumn } from '@/lib/catalog';

/**
 * Comparador entre las líneas de traje.
 *
 * Existe por un problema concreto de la tienda: las fichas de R-SKIN y
 * VEL-SKIN se leían idénticas —misma foto, mismas tallas, mismo texto de
 * homologación— y lo único que cambiaba era el precio. Quien entra no tiene
 * cómo saber qué compra de más, así que las dos líneas se muestran enfrentadas
 * fila por fila, con el dato numérico de cada una y la barra que lo compara.
 *
 * La línea superior no gana todas las filas a propósito: dura menos y cuesta
 * más ponérsela. Esa honestidad es la que hace creíbles las filas que sí gana.
 */
export function LineCompare({
  columns,
  activeSlug,
}: {
  columns: LineComparisonColumn[];
  /** Línea de la ficha que se está mirando: su columna queda marcada. */
  activeSlug: string | null;
}) {
  if (columns.length < 2) return null;

  // Las filas se enfrentan por etiqueta. Manda el orden de la primera línea, y
  // una fila que no exista en alguna columna se muestra igual, con un guion.
  const labels = columns[0].metrics.map((m) => m.label);

  // Una sola grilla para toda la tabla: los separadores salen del hueco de un
  // píxel sobre el fondo, así que valen igual en el teléfono —donde la
  // etiqueta se pone sobre las dos columnas— que en el escritorio.
  const grid = 'grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-[1.05fr_repeat(2,minmax(0,1fr))]';

  return (
    <section id="comparar" className="scroll-mt-20 border-t border-line bg-ink">
      <div className="container py-14 lg:py-20">
        <p className="eyebrow-accent mb-4">Cuál de las dos</p>
        <h2 className="max-w-2xl text-balance font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[34px]">
          {columns.map((c) => c.name).join(' o ')}: en qué se diferencian
        </h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-chalk-dim">
          Los dos trajes están homologados por World Aquatics y en la foto se ven casi iguales. La
          diferencia está en el tejido, y se mide.
        </p>

        <div className={cn(grid, 'mt-9')}>
          {/* Encabezado: una columna por línea */}
          <div className="hidden bg-ink-900 lg:block" />
          {columns.map((column) => {
            const active = column.slug === activeSlug;
            return (
              <div
                key={column.slug}
                className={cn('p-4', active ? 'bg-ink-800' : 'bg-ink-900')}
                style={{ ['--accent' as string]: column.accentHex }}
              >
                {column.tierLabel ? (
                  <span className="font-display text-[9.5px] font-semibold uppercase tracking-mega accent-text">
                    {column.tierLabel}
                  </span>
                ) : null}
                <p className="mt-1.5 font-display text-[19px] leading-none tracking-tight text-chalk">
                  {column.name}
                </p>
                {column.fromPrice != null ? (
                  <p className="mt-2 text-[13px] text-chalk-dim">
                    Desde <strong className="text-chalk">{formatCLP(column.fromPrice)}</strong>
                  </p>
                ) : null}
                {active ? (
                  <p className="mt-2 font-display text-[10px] font-semibold uppercase tracking-widest accent-text">
                    Estás viendo esta
                  </p>
                ) : null}
              </div>
            );
          })}

          {/* Una fila por medida */}
          {labels.map((label) => (
            <Fragment key={label}>
              <div className="col-span-2 bg-ink-900 px-4 py-3 lg:col-span-1 lg:py-4">
                <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim">
                  {label}
                </p>
              </div>

              {columns.map((column) => {
                const metric = column.metrics.find((m) => m.label === label);
                const active = column.slug === activeSlug;
                return (
                  <div
                    key={column.slug}
                    className={cn('p-4', active ? 'bg-ink-800' : 'bg-ink-900')}
                    style={{ ['--accent' as string]: column.accentHex }}
                  >
                    <p className="text-[15px] font-medium leading-tight text-chalk">
                      {metric?.value ?? '—'}
                    </p>
                    {metric ? (
                      <span
                        className="mt-2.5 block h-1 w-full bg-line-bright"
                        role="img"
                        aria-label={`${label}: ${metric.value} en ${column.name}`}
                      >
                        <span
                          className="block h-full accent-bg"
                          style={{ width: `${Math.min(100, Math.max(0, metric.score))}%` }}
                        />
                      </span>
                    ) : null}
                    {metric?.note ? (
                      <p className="mt-2 text-[12.5px] leading-snug text-chalk-faint">{metric.note}</p>
                    ) : null}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Para quién es cada una: es la fila que cierra la decisión */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {columns.map((column) => (
            <div
              key={column.slug}
              className={cn(
                'border p-5',
                column.slug === activeSlug ? 'accent-border bg-ink-800' : 'border-line bg-ink-900',
              )}
              style={{ ['--accent' as string]: column.accentHex }}
            >
              <p className="font-display text-[13px] font-semibold uppercase tracking-widest text-chalk">
                Elige {column.name} si…
              </p>
              {column.bestFor ? (
                <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-dim">{column.bestFor}</p>
              ) : null}

              {column.productSlug && column.slug !== activeSlug ? (
                <Link
                  href={`/producto/${column.productSlug}`}
                  className="mt-4 inline-flex font-display text-[11px] font-semibold uppercase tracking-widest accent-text underline underline-offset-4"
                >
                  Ver {column.productName}
                  {column.comingSoon ? ' (próximamente)' : ''}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
