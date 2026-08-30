import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'accent' | 'solid' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  accent:
    'accent-bg font-semibold hover:brightness-110 active:brightness-95 disabled:brightness-50',
  solid:
    'bg-chalk text-ink font-semibold hover:bg-white active:bg-chalk-dim',
  outline:
    'border border-line-bright text-chalk hover:border-chalk hover:bg-ink-800',
  ghost:
    'text-chalk-dim hover:text-chalk hover:bg-ink-800',
  danger:
    'bg-signal-bad/10 border border-signal-bad/40 text-signal-bad hover:bg-signal-bad/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[11px] tracking-widest',
  md: 'h-11 px-6 text-xs tracking-widest',
  lg: 'h-14 px-9 text-[13px] tracking-widest',
};

function classes(variant: Variant, size: Size, full?: boolean, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 font-display uppercase',
    'transition-all duration-200 ease-tech clip-notch-sm',
    'disabled:cursor-not-allowed disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    full && 'w-full',
    className,
  );
}

interface BaseProps {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'accent',
  size = 'md',
  full,
  className,
  children,
  ...props
}: BaseProps & ComponentProps<'button'>) {
  return (
    <button className={classes(variant, size, full, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'accent',
  size = 'md',
  full,
  className,
  children,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, size, full, className)} {...props}>
      {children}
    </Link>
  );
}
