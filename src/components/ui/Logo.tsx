import { cn } from '@/lib/utils';

/**
 * Marca TAUPOC: dos arcos cruzados sobre el wordmark.
 * Se dibuja en SVG para que escale sin pérdida y herede el color del contexto.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 150"
      aria-hidden
      className={cn('h-6 w-auto', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={11}
      strokeLinecap="square"
    >
      <path d="M18 8 C 30 62, 48 100, 70 130" />
      <path d="M122 8 C 110 62, 92 100, 70 130" />
      <path d="M40 76 L 104 122" />
      <path d="M100 76 L 36 122" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-chalk', className)}>
      <LogoMark className="h-7 w-auto" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-[0.24em]">TAUPOC</span>
        {!compact ? (
          <span className="mt-[3px] font-display text-[8.5px] font-semibold tracking-[0.32em] text-chalk-faint">
            CHILE
          </span>
        ) : null}
      </span>
    </span>
  );
}
