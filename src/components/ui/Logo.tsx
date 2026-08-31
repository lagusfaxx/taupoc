import { cn } from '@/lib/utils';
import { mediaSrcSet } from '@/lib/media-url';

/**
 * Marca TAUPOC: dos cuernos cruzados, cada uno con su hoja fina por dentro,
 * que al cruzarse dibujan el rombo del centro. Se dibuja en SVG para que
 * escale sin pérdida y herede el color del contexto.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 272 340"
      aria-hidden
      className={cn('h-6 w-auto', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="butt"
    >
      <path d="M33 18 C 38 156, 96 250, 224 320" strokeWidth={20} />
      <path d="M51 26 C 64 148, 136 210, 196 320" strokeWidth={8} />
      <path d="M239 18 C 234 156, 176 250, 48 320" strokeWidth={20} />
      <path d="M221 26 C 208 148, 136 210, 76 320" strokeWidth={8} />
    </svg>
  );
}

export function Logo({
  className,
  compact,
  src,
  height = 28,
}: {
  className?: string;
  compact?: boolean;
  src?: string | null;
  height?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        srcSet={mediaSrcSet(src)}
        sizes={`${height * 6}px`}
        alt="TAUPOC Chile"
        style={{ height }}
        className={cn('w-auto max-w-[240px] object-contain', className)}
      />
    );
  }

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
