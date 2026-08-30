import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'text-[15px]',
  md: 'text-xl',
  lg: 'text-3xl',
} as const;

export function Price({
  amount,
  size = 'md',
  className,
}: {
  amount: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn('font-display font-bold tracking-tight text-chalk', SIZES[size], className)}>
      {formatCLP(amount)}
    </span>
  );
}
