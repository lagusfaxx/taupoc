import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';

/** Datos de la cuenta, monto y referencia: lo que el cliente necesita para transferir. */
export function TransferInstructions({
  instructions,
  total,
  orderNumber,
  className,
}: {
  instructions: string;
  total: number;
  orderNumber: string;
  className?: string;
}) {
  return (
    <div className={cn('border accent-border bg-ink-900 p-5', className)}>
      <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Datos para transferir</p>
      <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-chalk">
        {instructions.trim() || 'Te escribiremos con los datos de la cuenta.'}
      </p>
      <dl className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2">
        <div className="bg-ink-900 p-3.5">
          <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Monto exacto</dt>
          <dd className="mt-1 font-display text-lg font-bold tracking-tight accent-text">{formatCLP(total)}</dd>
        </div>
        <div className="bg-ink-900 p-3.5">
          <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Comentario</dt>
          <dd className="mt-1 font-display text-lg font-bold tracking-tight text-chalk">{orderNumber}</dd>
        </div>
      </dl>
    </div>
  );
}
