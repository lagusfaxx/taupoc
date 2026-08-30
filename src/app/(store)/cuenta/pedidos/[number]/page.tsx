import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, orderStatusTone, paymentStatusTone } from '@/lib/orders';
import { Badge } from '@/components/ui/Badge';
import { OrderTimeline } from '@/components/store/OrderTimeline';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return buildMetadata({ title: `Pedido ${number}`, path: `/cuenta/pedidos/${number}`, noIndex: true });
}

export default async function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const user = await requireUser();
  const { number } = await params;

  const order = await prisma.order.findFirst({
    where: { number, OR: [{ userId: user.id }, { email: user.email }] },
    include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) notFound();

  return (
    <div className="space-y-8">
      <Link href="/cuenta/pedidos" className="inline-block font-display text-[11px] uppercase tracking-widest text-chalk-faint hover:text-chalk">
        ← Mis pedidos
      </Link>

      <div className="surface">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-display text-[22px] tracking-tight text-chalk">{order.number}</h2>
            <p className="mt-1 text-[13px] text-chalk-faint">Realizado el {formatDate(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            <Badge tone={paymentStatusTone(order.paymentStatus)}>
              Pago: {PAYMENT_STATUS_LABEL[order.paymentStatus]}
            </Badge>
          </div>
        </div>

        <OrderTimeline status={order.status} isPickup={order.isPickup} />

        {order.trackingNumber ? (
          <div className="border-t border-line px-5 py-5 sm:px-6">
            <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
              Seguimiento {order.shippingCarrier}
            </p>
            <p className="mt-2 font-mono text-[20px] tracking-wider accent-text">{order.trackingNumber}</p>
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-display text-[11px] uppercase tracking-widest text-chalk-dim underline underline-offset-4 hover:text-chalk"
              >
                Rastrear envío ↗
              </a>
            ) : null}
          </div>
        ) : null}

        <ul className="divide-y divide-line border-t border-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 px-5 py-4 sm:px-6">
              {item.imageUrl ? (
                <span className="relative h-20 w-16 shrink-0 overflow-hidden border border-line bg-ink-800">
                  <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-display text-[14px] tracking-tight text-chalk">{item.productName}</p>
                <p className="mt-1 text-[13px] text-chalk-faint">
                  {item.colorName} · Talla {item.size}
                </p>
                <p className="mt-0.5 font-mono text-[11.5px] text-chalk-faint/80">{item.sku}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] text-chalk">{formatCLP(item.lineTotal)}</p>
                <p className="mt-0.5 text-[12.5px] text-chalk-faint">{item.quantity} × {formatCLP(item.unitPrice)}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line px-5 py-5 text-[14px] sm:px-6">
          <div className="flex justify-between">
            <dt className="text-chalk-faint">Subtotal</dt>
            <dd className="text-chalk">{formatCLP(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <dt className="text-chalk-faint">Descuento {order.couponCode ? `(${order.couponCode})` : ''}</dt>
              <dd className="text-signal-ok">−{formatCLP(order.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-chalk-faint">Despacho — {order.shippingLabel}</dt>
            <dd className="text-chalk">{order.shippingTotal > 0 ? formatCLP(order.shippingTotal) : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3">
            <dt className="font-display text-[13px] uppercase tracking-widest text-chalk">Total</dt>
            <dd className="font-display text-[20px] font-bold accent-text">{formatCLP(order.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface p-5">
          <h3 className="font-display text-[11px] uppercase tracking-mega text-chalk-faint">Entrega</h3>
          <p className="mt-2.5 text-[14px] text-chalk">{order.shippingLabel}</p>
          {order.isPickup ? (
            <p className="mt-1 text-[13px] text-chalk-faint">
              Retiro coordinado. Te avisamos cuando esté listo.
            </p>
          ) : (
            <address className="mt-1 not-italic text-[13px] leading-relaxed text-chalk-faint">
              {order.firstName} {order.lastName}<br />
              {[order.street, order.streetNumber].filter(Boolean).join(' ')}
              {order.addressExtra ? `, ${order.addressExtra}` : ''}<br />
              {order.commune}, {regionName(order.region)}<br />
              {order.phone}
            </address>
          )}
        </div>

        <div className="surface p-5">
          <h3 className="font-display text-[11px] uppercase tracking-mega text-chalk-faint">Historial</h3>
          <ol className="mt-3 space-y-3">
            {order.events.map((event) => (
              <li key={event.id} className="border-l border-line pl-3.5 text-[13px]">
                <p className="text-chalk-dim">{event.message}</p>
                <p className="mt-0.5 text-[11.5px] text-chalk-faint">{formatDateTime(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
