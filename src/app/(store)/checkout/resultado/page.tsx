import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/orders';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconAlert, IconCheck, IconTruck } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Resultado del pago',
  path: '/checkout/resultado',
  noIndex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutResultPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const number = Array.isArray(params.order) ? params.order[0] : params.order;
  if (!number) notFound();

  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: true },
  });
  if (!order) notFound();

  const noGateway = params.estado === 'sin-pasarela';
  const approved = order.paymentStatus === 'APPROVED';
  const rejected = order.paymentStatus === 'REJECTED' || order.paymentStatus === 'CANCELLED';

  const headline = noGateway
    ? 'Pedido registrado'
    : approved
      ? '¡Pago confirmado!'
      : rejected
        ? 'El pago no se completó'
        : 'Estamos confirmando tu pago';

  const message = noGateway
    ? 'Guardamos tu pedido. Te contactamos para coordinar el pago y el despacho.'
    : approved
      ? 'Ya estamos preparando tu envío. Te avisamos por correo cuando salga con el número de seguimiento.'
      : rejected
        ? 'El medio de pago rechazó la transacción. Puedes volver a intentarlo con otra tarjeta.'
        : 'Mercado Pago está procesando la transacción. Apenas se acredite te llega el correo de confirmación. Esto puede tardar unos minutos.';

  const tone = approved ? 'ok' : rejected ? 'bad' : 'warn';
  const Icon = approved ? IconCheck : rejected ? IconAlert : IconTruck;

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
              <dd className="mt-1.5 font-display text-lg font-bold tracking-tight text-chalk">{order.number}</dd>
            </div>
            <div className="bg-ink-900 p-4">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Fecha</dt>
              <dd className="mt-1.5 text-[15px] text-chalk">{formatDate(order.createdAt)}</dd>
            </div>
            <div className="bg-ink-900 p-4">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Estado del pago</dt>
              <dd className="mt-1.5">
                <Badge tone={tone}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
              </dd>
            </div>
            <div className="bg-ink-900 p-4">
              <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Total</dt>
              <dd className="mt-1.5 font-display text-lg font-bold tracking-tight accent-text">
                {formatCLP(order.total)}
              </dd>
            </div>
          </dl>

          <ul className="mt-6 divide-y divide-line border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3.5 text-[14px]">
                <span>
                  <span className="block text-chalk">{item.productName}</span>
                  <span className="block text-[13px] text-chalk-faint">
                    {item.colorName} · Talla {item.size} · {item.quantity} u.
                  </span>
                </span>
                <span className="shrink-0 text-chalk">{formatCLP(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 text-[13.5px] leading-relaxed text-chalk-dim">
            <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Entrega</p>
            <p className="mt-1.5">
              {order.shippingLabel}
              {order.shippingCarrier ? ` · ${order.shippingCarrier}` : ''}
            </p>
            {!order.isPickup ? (
              <p className="text-chalk-faint">
                {[order.street, order.streetNumber].filter(Boolean).join(' ')}
                {order.addressExtra ? `, ${order.addressExtra}` : ''}
                {order.commune ? `, ${order.commune}` : ''}
                {order.region ? `, ${regionName(order.region)}` : ''}
              </p>
            ) : null}
            <p className="mt-3 text-chalk-faint">
              Estado del pedido: {ORDER_STATUS_LABEL[order.status]}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/cuenta/pedidos" size="lg">Ver mis pedidos</ButtonLink>
            <ButtonLink href="/catalogo" variant="outline" size="lg">Seguir comprando</ButtonLink>
          </div>

          {!approved && !noGateway ? (
            <p className="mt-6 text-[13px] text-chalk-faint">
              ¿Algo no cuadra?{' '}
              <Link href="/contacto" className="underline underline-offset-4 hover:text-chalk">
                Escríbenos
              </Link>{' '}
              con el número {order.number} y lo revisamos.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
