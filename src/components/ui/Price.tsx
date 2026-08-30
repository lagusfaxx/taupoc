import { formatCLP, percentOff } from '@/lib/money';
import { cn } from '@/lib/utils';

export function Price({
  amount,
  compareAt,
  size = 'md',
  className,
}: {
  amount: number;
  compareAt?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const off = percentOff(amount, compareAt);
  const sizes = {
    sm: 'text-[15px]',
    md: 'text-xl',
    lg: 'text-3xl',
  } as const;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1', className)}>
      <span className={cn('font-display font-bold tracking-tight text-chalk', sizes[size])}>
        {formatCLP(amount)}
      </span>
      {compareAt && compareAt > amount ? (
        <>
          <span className="text-[13px] text-chalk-faint line-through">{formatCLP(compareAt)}</span>
          {off ? (
            <span className="border border-signal-ok/40 bg-signal-ok/10 px-1.5 py-0.5 font-display text-[10px] font-semibold tracking-widest text-signal-ok">
              −{off}%
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}
