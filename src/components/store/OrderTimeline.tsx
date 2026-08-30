import { cn } from '@/lib/utils';
import { IconCheck } from '@/components/ui/Icons';

const STEPS = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const LABELS: Record<(typeof STEPS)[number], string> = {
  PENDING: 'Pedido recibido',
  PAID: 'Pago confirmado',
  PROCESSING: 'En preparación',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
};

/** Línea de tiempo del pedido. Los estados terminales negativos no la muestran. */
export function OrderTimeline({ status, isPickup }: { status: string; isPickup: boolean }) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return (
      <div className="border-t border-line px-5 py-5 sm:px-6">
        <p className="text-[14px] text-signal-bad">
          {status === 'CANCELLED'
            ? 'Este pedido fue cancelado. Si crees que es un error, escríbenos.'
            : 'Este pedido fue reembolsado. El dinero vuelve al medio de pago original.'}
        </p>
      </div>
    );
  }

  const current = STEPS.indexOf(status as (typeof STEPS)[number]);
  const labels = { ...LABELS, SHIPPED: isPickup ? 'Listo para retiro' : 'Despachado' };

  return (
    <ol className="flex flex-wrap gap-y-5 border-t border-line px-5 py-6 sm:px-6">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        return (
          <li key={step} className="flex min-w-[104px] flex-1 flex-col items-start">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center border text-[10px]',
                  done ? 'accent-border accent-bg' : 'border-line text-chalk-faint',
                )}
              >
                {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {i < STEPS.length - 1 ? (
                <span className={cn('h-px flex-1', i < current ? 'accent-bg' : 'bg-line')} />
              ) : null}
            </div>
            <p
              className={cn(
                'mt-2.5 pr-3 font-display text-[10px] uppercase tracking-widest',
                active ? 'accent-text' : done ? 'text-chalk-dim' : 'text-chalk-faint',
              )}
            >
              {labels[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
