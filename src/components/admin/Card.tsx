import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn('border border-line bg-ink-900', className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-display text-[12px] font-semibold uppercase tracking-widest text-chalk">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[12.5px] text-chalk-faint">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
}) {
  const valueTone =
    tone === 'ok' ? 'text-signal-ok'
    : tone === 'warn' ? 'text-signal-warn'
    : tone === 'bad' ? 'text-signal-bad'
    : tone === 'info' ? 'text-signal-info'
    : tone === 'accent' ? 'accent-text'
    : 'text-chalk';

  return (
    <div className="border border-line bg-ink-900 p-5">
      <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">{label}</p>
      <p className={cn('mt-2.5 font-display text-[26px] font-bold leading-none tracking-tight', valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] text-chalk-faint">{hint}</p> : null}
    </div>
  );
}
