import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCLP } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { findReturnByToken } from '@/lib/order-returns';
import { RETURN_KIND_LABEL, RETURN_STATUS_LABEL } from '@/lib/order-labels';
import { payReturnFee } from '@/actions/return-fee';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconCheck, IconTruck } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Pago del envío de tu devolución',
  path: '/devoluciones',
  noIndex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Enlace público de pago del envío de una devolución. Lo abre el cliente
 * desde el correo o desde el estado de su pedido, con o sin cuenta.
 */
export default async function ReturnFeePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const query = await searchParams;
  const one = (k: string) => (Array.isArray(query[k]) ? query[k]![0] : query[k]) as string | undefined;

  const ret = await findReturnByToken(token);
  if (!ret || ret.feeStatus === 'NONE') notFound();

  const paid = ret.feeStatus === 'PAID';
  const waived = ret.feeStatus === 'WAIVED';
  // Lo que Mercado Pago agrega al volver; el webhook es el que confirma.
  const mpStatus = one('collection_status') ?? one('status');
  const estado = one('estado');
  const returningApproved = !paid && mpStatus === 'approved';
  const returningFailed = !paid && (mpStatus === 'rejected' || mpStatus === 'null' || estado === 'error');

  const tone = paid || waived ? 'ok' : returningFailed ? 'bad' : 'warn';
  const Icon = paid || waived ? IconCheck : returningFailed ? IconAlert : IconTruck;
  const headline = paid
    ? 'Envío pagado'
    : waived
      ? 'Este envío no tiene costo'
      : returningApproved
        ? 'Estamos confirmando tu pago'
        : returningFailed
          ? 'El pago no se completó'
          : 'Paga el envío de tu devolución';
  const message = paid
    ? `Recibimos el pago${ret.feePaidAt ? ` el ${formatDateTime(ret.feePaidAt)}` : ''}. Seguimos con tu devolución y te avisamos por correo.`
    : waived
      ? 'No tienes que pagar nada por este envío. Seguimos con tu devolución.'
      : returningApproved
        ? 'Mercado Pago aprobó el pago y lo estamos registrando. Recarga esta página en unos minutos.'
        : estado === 'espera'
          ? 'Intentaste muchas veces seguidas. Espera unos minutos y vuelve a intentarlo.'
          : returningFailed
            ? 'El medio de pago rechazó la transacción o hubo un problema. Puedes volver a intentarlo.'
            : 'Para seguir con tu devolución o cambio de talla, paga el costo de envío con Mercado Pago.';

  const showPay = ret.feeStatus === 'PENDING' && !returningApproved && ret.status !== 'CANCELLED';

  return (
    <div className="container py-14 lg:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="surface p-7 sm:p-10">
          <div className="flex items-start gap-4">
            <span
              className={
                tone === 'ok'
                  ? 'flex h-12 w-12 shrink-0 items-center justify-center border border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                  : tone === 'bad'
                    ? 'flex h-12 w-12 shrink-0 items-center justify-center border border-signal-bad/40 bg-signal-bad/10 text-signal-bad'
                    : 'flex h-12 w-12 shrink-0 items-center justify-center border border-signal-warn/40 bg-signal-warn/10 text-signal-warn'
              }
            >
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-[26px] leading-tight tracking-tight text-chalk sm:text-[32px]">
                {headline}
              </h1>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-chalk-dim">{message}</p>
            </div>
          </div>

          <dl className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2">
            <div className="bg-ink-900 p-4">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Pedido</dt>
              <dd className="mt-1.5 font-display text-lg font-bold tracking-tight text-chalk">{ret.order.number}</dd>
            </div>
            <div className="bg-ink-900 p-4">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Devolución</dt>
              <dd className="mt-1.5 text-[15px] text-chalk">
                {RETURN_KIND_LABEL[ret.kind]} · {RETURN_STATUS_LABEL[ret.status]}
              </dd>
            </div>
            <div className="bg-ink-900 p-4 sm:col-span-2">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                {ret.feeLabel || 'Costo de envío de la devolución'}
              </dt>
              <dd className="mt-1.5 font-display text-[24px] font-bold accent-text">
                {waived ? 'Sin cargo' : formatCLP(ret.feeAmount)}
              </dd>
            </div>
            {ret.reason ? (
              <div className="bg-ink-900 p-4 sm:col-span-2">
                <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Motivo</dt>
                <dd className="mt-1.5 whitespace-pre-line text-[14px] text-chalk-dim">{ret.reason}</dd>
              </div>
            ) : null}
          </dl>

          {showPay ? (
            <form action={payReturnFee} className="mt-8">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" size="lg" full>
                Pagar {formatCLP(ret.feeAmount)} con Mercado Pago
              </Button>
              <p className="mt-3 text-center text-[12.5px] text-chalk-faint">
                Te llevamos a Mercado Pago para pagar de forma segura.
              </p>
            </form>
          ) : null}

          <p className="mt-8 text-[13px] text-chalk-faint">
            ¿Dudas? <Link href="/contacto" className="underline underline-offset-4">Escríbenos</Link> con el número de pedido.
          </p>
        </div>
      </div>
    </div>
  );
}
