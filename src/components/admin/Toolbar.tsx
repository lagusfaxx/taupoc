'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { IconSearch } from '@/components/ui/Icons';

/**
 * Barra de búsqueda y filtros que escribe el estado en la URL.
 * Así el admin puede compartir o guardar una vista filtrada.
 */
export function Toolbar({
  searchPlaceholder = 'Buscar…',
  filters = [],
}: {
  searchPlaceholder?: string;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('pagina');
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className={cn('mb-5 flex flex-wrap items-center gap-2.5', pending && 'opacity-60')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam('q', query.trim());
        }}
        className="relative min-w-[220px] flex-1"
      >
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 w-full border border-line bg-ink-900 pl-9 pr-3 text-[13.5px] text-chalk placeholder:text-chalk-faint/70 focus:border-[var(--accent)] focus:outline-none"
        />
      </form>

      {filters.map((filter) => (
        <label key={filter.name} className="relative flex shrink-0 items-center">
          <span className="sr-only">{filter.label}</span>
          <select
            value={params.get(filter.name) ?? ''}
            onChange={(e) => setParam(filter.name, e.target.value)}
            className="h-10 appearance-none border border-line bg-ink-900 px-3 pr-8 text-[13px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
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
      ))}
    </div>
  );
}
