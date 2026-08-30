import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'accent';

const TONES: Record<Tone, string> = {
  ok: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
  warn: 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
  bad: 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
  info: 'border-signal-info/40 bg-signal-info/10 text-signal-info',
  muted: 'border-line-bright bg-ink-700 text-chalk-faint',
  accent: 'accent-border bg-ink-800 accent-text',
};

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-1',
        'font-display text-[10px] font-semibold uppercase tracking-widest',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Punto de estado con animación sutil, para "en vivo" y stock. */
export function Dot({ tone = 'ok', pulse }: { tone?: Tone; pulse?: boolean }) {
  const color =
    tone === 'ok' ? 'bg-signal-ok'
    : tone === 'warn' ? 'bg-signal-warn'
    : tone === 'bad' ? 'bg-signal-bad'
    : tone === 'info' ? 'bg-signal-info'
    : 'bg-chalk-faint';
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', color, pulse && 'animate-pulse-dot')} />;
}
