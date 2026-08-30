'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

export function PeriodPicker({
  periods,
  current,
}: {
  periods: { value: string; label: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set('periodo', value);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', pending && 'opacity-60')} role="group" aria-label="Período">
      {periods.map((period) => (
        <button
          key={period.value}
          type="button"
          onClick={() => select(period.value)}
          aria-pressed={period.value === current}
          className={cn(
            'h-9 border px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest transition-colors',
            period.value === current
              ? 'accent-border accent-text bg-ink-800'
              : 'border-line text-chalk-dim hover:border-line-bright hover:text-chalk',
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
