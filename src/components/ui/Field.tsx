'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full bg-ink-900 border border-line px-3.5 py-3 text-[15px] text-chalk placeholder:text-chalk-faint/60 ' +
  'transition-colors duration-150 focus:border-[var(--accent)] focus:outline-none disabled:opacity-50';

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline justify-between gap-3 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim"
    >
      <span>{children}</span>
      {hint ? <span className="font-sans text-[11px] normal-case tracking-normal text-chalk-faint">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-signal-bad">{children}</p>;
}

interface WrapProps {
  label?: string;
  hint?: string;
  error?: string;
  help?: string;
  className?: string;
}

export function Input({ label, hint, error, help, className, ...props }: WrapProps & ComponentProps<'input'>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className={className}>
      {label ? <Label htmlFor={id} hint={hint}>{label}</Label> : null}
      <input id={id} className={cn(CONTROL, error && 'border-signal-bad')} {...props} />
      {help && !error ? <p className="mt-1.5 text-[13px] text-chalk-faint">{help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Textarea({ label, hint, error, help, className, ...props }: WrapProps & ComponentProps<'textarea'>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className={className}>
      {label ? <Label htmlFor={id} hint={hint}>{label}</Label> : null}
      <textarea id={id} rows={5} className={cn(CONTROL, 'resize-y', error && 'border-signal-bad')} {...props} />
      {help && !error ? <p className="mt-1.5 text-[13px] text-chalk-faint">{help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Select({
  label, hint, error, help, className, children, ...props
}: WrapProps & ComponentProps<'select'>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className={className}>
      {label ? <Label htmlFor={id} hint={hint}>{label}</Label> : null}
      <div className="relative">
        <select
          id={id}
          className={cn(CONTROL, 'appearance-none pr-10', error && 'border-signal-bad')}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className="pointer-events-none absolute right-3.5 top-1/2 h-2 w-3 -translate-y-1/2 fill-none stroke-chalk-faint stroke-[1.6]"
        >
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </div>
      {help && !error ? <p className="mt-1.5 text-[13px] text-chalk-faint">{help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Checkbox({
  label, className, ...props
}: { label: ReactNode; className?: string } & ComponentProps<'input'>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 text-[14px] text-chalk-dim', className)}>
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer h-full w-full cursor-pointer appearance-none border border-line-bright bg-ink-900 transition-colors checked:border-[var(--accent)] checked:bg-[var(--accent)]"
          {...props}
        />
        <svg
          aria-hidden
          viewBox="0 0 14 14"
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 fill-none stroke-[var(--accent-contrast)] stroke-[2.4] opacity-0 transition-opacity peer-checked:opacity-100"
        >
          <path d="M2 7.4 5.4 11 12 3.4" strokeLinecap="square" />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}
