'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (pageCount <= 1) {
    return (
      <p className="mt-4 text-[12.5px] text-chalk-faint">
        {total} {total === 1 ? 'registro' : 'registros'}
      </p>
    );
  }

  function go(next: number) {
    const search = new URLSearchParams(params.toString());
    if (next <= 1) search.delete('pagina');
    else search.set('pagina', String(next));
    const qs = search.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12.5px] text-chalk-faint">
        Página {page} de {pageCount} · {total} registros
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="h-9 border border-line px-3.5 font-display text-[11px] uppercase tracking-widest text-chalk-dim transition-colors hover:border-line-bright hover:text-chalk disabled:opacity-35"
        >
          Anterior
        </button>
        {Array.from({ length: Math.min(pageCount, 7) }).map((_, i) => {
          const start = Math.max(1, Math.min(page - 3, pageCount - 6));
          const n = start + i;
          if (n > pageCount) return null;
          return (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cn(
                'h-9 w-9 border font-display text-[12px] transition-colors',
                n === page
                  ? 'accent-border accent-text bg-ink-800'
                  : 'border-line text-chalk-dim hover:border-line-bright hover:text-chalk',
              )}
            >
              {n}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= pageCount}
          className="h-9 border border-line px-3.5 font-display text-[11px] uppercase tracking-widest text-chalk-dim transition-colors hover:border-line-bright hover:text-chalk disabled:opacity-35"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
