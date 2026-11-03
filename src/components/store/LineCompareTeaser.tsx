import Link from 'next/link';
import { formatCLP } from '@/lib/money';
import type { LineComparisonColumn } from '@/lib/catalog';
import { IconArrow } from '@/components/ui/Icons';

/** Versión corta del comparador de líneas, para la portada y el catálogo. */
export function LineCompareTeaser({ columns }: { columns: LineComparisonColumn[] }) {
  if (columns.length < 2) return null;

  return (
    <section className="border-t border-line bg-ink-900">
      <div className="container py-10 lg:py-12">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="min-w-0">
            <p className="eyebrow-accent mb-3">Líneas</p>
            <h2 className="text-balance font-display text-[22px] leading-tight tracking-tight text-chalk lg:text-[26px]">
              {columns.map((c) => c.name).join(' vs ')}
            </h2>

            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column.slug} style={{ ['--accent' as string]: column.accentHex }}>
                  <dt className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="font-display text-[15px] tracking-tight text-chalk">
                      {column.name}
                    </span>
                    {column.tierLabel ? (
                      <span className="font-display text-[9.5px] font-semibold uppercase tracking-mega accent-text">
                        {column.tierLabel}
                      </span>
                    ) : null}
                    {column.fromPrice != null ? (
                      <span className="text-[12.5px] text-chalk-faint">
                        desde {formatCLP(column.fromPrice)}
                      </span>
                    ) : null}
                  </dt>
                  {column.claim ? (
                    <dd className="mt-1 text-[13px] leading-snug text-chalk-dim">{column.claim}</dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>

          <Link
            href="/lineas"
            className="group inline-flex shrink-0 items-center gap-2 border border-line-bright px-5 py-3.5 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk"
          >
            Comparar
            <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
