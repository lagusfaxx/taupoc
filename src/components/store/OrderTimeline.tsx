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

  // En el teléfono cinco pasos no caben en una fila: antes se partían en filas
  // de a dos y las líneas de unión quedaban colgando. Ahí va vertical, con la
  // etiqueta al lado; desde sm vuelve a ser una sola fila horizontal.
  return (
    <ol className="border-t border-line px-5 py-6 sm:flex sm:px-6">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        const last = i === STEPS.length - 1;
        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className="relative flex items-center gap-3.5 pb-5 last:pb-0 sm:min-w-0 sm:flex-1 sm:flex-col sm:items-start sm:gap-0 sm:pb-0"
          >
            <div className="flex items-center sm:w-full">
              <span
                className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center border text-[10px]',
                  done ? 'accent-border accent-bg' : 'border-line bg-ink-900 text-chalk-faint',
                )}
              >
                {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    // Vertical bajo el marcador en el teléfono; horizontal hacia el siguiente paso desde sm.
                    'absolute left-3 top-6 bottom-0 w-px sm:static sm:h-px sm:w-auto sm:flex-1',
                    i < current ? 'accent-bg' : 'bg-line',
                  )}
                />
              ) : null}
            </div>
            <p
              className={cn(
                'font-display text-[11px] uppercase tracking-widest sm:mt-2.5 sm:pr-3 sm:text-[10px]',
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
