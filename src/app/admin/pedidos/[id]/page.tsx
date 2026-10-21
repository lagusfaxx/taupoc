import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatCLP } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import {
  ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, orderStatusTone, paymentStatusTone,
} from '@/lib/orders';
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-methods';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import {
  OrderNoteForm, OrderStatusForm, RefundForm, TrackingForm, OrderItemsForm, TransferForm,
  type AvailableVariant,
} from '@/components/admin/OrderPanel';
import { IconPrint } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Detalle de pedido', noIndex: true });

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      events: { orderBy: { createdAt: 'desc' } },
      user: { select: { id: true, email: true, name: true, clubName: true } },
    },
  });
  if (!order) notFound();

  const productIds = [...new Set(order.items.map((i) => i.productId).filter(Boolean))] as string[];

  const [otherOrders, rawVariants] = await Promise.all([
    prisma.order.count({ where: { email: order.email, id: { not: order.id } } }),
    productIds.length > 0
      ? prisma.variant.findMany({
          where: { productId: { in: productIds }, active: true },
          include: {
            product: { select: { id: true, name: true } },
            color: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ color: { name: 'asc' } }, { size: 'asc' }],
        })
      : [],
  ]);

  const availableVariants: AvailableVariant[] = rawVariants.map((v) => ({
    id: v.id,
    productId: v.productId,
    productName: v.product.name,
    colorName: v.color.name,
    colorCode: v.color.code,
    size: v.size,
    sku: v.sku,
    stock: v.stock,
  }));

  return (
    <>
      <PageHeader
        title={`Pedido ${order.number}`}
        description={`Creado el ${formatDateTime(order.createdAt)}${order.paidAt ? ` · Pagado el ${formatDateTime(order.paidAt)}` : ''}`}
        back={{ href: '/admin/pedidos', label: 'Pedidos' }}
        actions={
          <>
            <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            <Badge tone={paymentStatusTone(order.paymentStatus)}>
              Pago: {PAYMENT_STATUS_LABEL[order.paymentStatus]}
            </Badge>
            <Link href={`/cuenta/pedidos/${order.number}`} target="_blank" className="text-sm underline">Ver seguimiento como cliente ↗</Link>
            <Link
              href={`/admin/pedidos/${order.id}/packing`}
              target="_blank"
              className="inline-flex h-9 items-center gap-2 border border-line px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
            >
              <IconPrint className="h-3.5 w-3.5" />
              Packing slip
            </Link>
          </>
        }
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title={`Productos (${order.items.length})`} padded={false}>
            <Table minWidth={640}>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>SKU</Th>
                  <Th align="center">Cant.</Th>
                  <Th align="right">Unitario</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <span className="relative h-12 w-10 shrink-0 overflow-hidden border border-line bg-ink-800">
                            <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                          </span>
                        ) : null}
                        <span>
                          <span className="block text-chalk">{item.productName}</span>
                          <span className="block text-[11.5px] text-chalk-faint">
                            {item.colorName} · Talla {item.size}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td className="font-mono text-[12px]">{item.sku}</Td>
                    <Td align="center">{item.quantity}</Td>
                    <Td align="right">{formatCLP(item.unitPrice)}</Td>
                    <Td align="right" className="font-medium text-chalk">{formatCLP(item.lineTotal)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <dl className="space-y-2 border-t border-line px-5 py-4 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Subtotal</dt>
                <dd className="text-chalk">{formatCLP(order.subtotal)}</dd>
              </div>
              {order.discountTotal - order.paymentDiscount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-chalk-faint">Descuento {order.couponCode ? `(${order.couponCode})` : ''}</dt>
                  <dd className="text-signal-ok">−{formatCLP(order.discountTotal - order.paymentDiscount)}</dd>
                </div>
              ) : null}
              {order.paymentDiscount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-chalk-faint">Descuento {PAYMENT_METHOD_LABEL[order.paymentMethod].toLowerCase()}</dt>
                  <dd className="text-signal-ok">−{formatCLP(order.paymentDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Despacho — {order.shippingLabel ?? '—'}</dt>
                <dd className="text-chalk">{order.shippingTotal > 0 ? formatCLP(order.shippingTotal) : 'Gratis'}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3">
                <dt className="font-display text-[12px] uppercase tracking-widest text-chalk">Total</dt>
                <dd className="font-display text-[18px] font-bold accent-text">{formatCLP(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="Cliente">
              <p className="text-[14px] text-chalk">{order.firstName} {order.lastName}</p>
              <p className="mt-1 text-[13px] text-chalk-dim">{order.email}</p>
              {order.phone ? <p className="text-[13px] text-chalk-dim">{order.phone}</p> : null}
              {order.user?.clubName ? (
                <p className="mt-2 text-[12.5px] text-chalk-faint">Club: {order.user.clubName}</p>
              ) : null}
              <p className="mt-3 text-[12.5px] text-chalk-faint">
                {otherOrders > 0
                  ? `Cliente recurrente · ${otherOrders} ${otherOrders === 1 ? 'pedido anterior' : 'pedidos anteriores'}`
                  : 'Primera compra'}
              </p>
              {order.user ? (
                <Link
                  href={`/admin/clientes/${order.user.id}`}
                  className="mt-3 inline-block font-display text-[10.5px] uppercase tracking-widest accent-text"
                >
                  Ver ficha del cliente →
                </Link>
              ) : (
                <p className="mt-3 text-[12px] text-chalk-faint">Compró como invitado.</p>
              )}
            </Card>

            <Card title="Entrega">
              <p className="text-[14px] text-chalk">{order.shippingLabel ?? '—'}</p>
              <p className="mt-1 text-[13px] text-chalk-faint">{order.shippingCarrier ?? ''}</p>
              {order.isPickup ? (
                <p className="mt-3 text-[13px] text-chalk-dim">Retiro coordinado con el cliente.</p>
              ) : (
                <address className="mt-3 not-italic text-[13px] leading-relaxed text-chalk-dim">
                  {[order.street, order.streetNumber].filter(Boolean).join(' ')}
                  {order.addressExtra ? `, ${order.addressExtra}` : ''}<br />
                  {order.commune}, {regionName(order.region)}<br />
                  {order.postalCode ? `CP ${order.postalCode}` : ''}
                </address>
              )}
              {order.customerNote ? (
                <p className="mt-4 border-l-2 accent-border bg-ink-800 px-3 py-2 text-[13px] text-chalk-dim">
                  <span className="block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                    Nota del cliente
                  </span>
                  {order.customerNote}
                </p>
              ) : null}
            </Card>
          </div>

          <Card title="Pago">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {(order.paymentMethod === 'TRANSFER'
                ? [
                    ['Método', PAYMENT_METHOD_LABEL[order.paymentMethod]],
                    ['Estado', PAYMENT_STATUS_LABEL[order.paymentStatus]],
                    ['Monto a recibir', formatCLP(order.total)],
                    ['Descuento por transferencia', order.paymentDiscount > 0 ? formatCLP(order.paymentDiscount) : '—'],
                  ]
                : [
                    ['Método', PAYMENT_METHOD_LABEL[order.paymentMethod]],
                    ['Estado', PAYMENT_STATUS_LABEL[order.paymentStatus]],
                    ['ID de pago', order.mpPaymentId ?? '—'],
                    ['Medio', order.mpPaymentType ?? '—'],
                    ['Cuotas', order.mpInstallments ? String(order.mpInstallments) : '—'],
                    ['Detalle', order.mpStatusDetail ?? '—'],
                    ['Preferencia', order.mpPreferenceId ?? '—'],
                  ]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">{label}</dt>
                  <dd className="mt-1 break-all text-[13px] text-chalk-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Historial" padded={false}>
            <ol className="divide-y divide-line-soft">
              {order.events.map((event) => (
                <li key={event.id} className="px-5 py-3">
                  <p className="text-[13px] text-chalk-dim">{event.message}</p>
                  <p className="mt-0.5 text-[11.5px] text-chalk-faint">
                    {formatDateTime(event.createdAt)}
                    {event.actor ? ` · ${event.actor}` : ''}
                  </p>
                </li>
              ))}
              {order.events.length === 0 ? (
                <li className="px-5 py-6 text-[13px] text-chalk-faint">Sin eventos registrados.</li>
              ) : null}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {order.paymentMethod === 'TRANSFER' && order.status === 'PENDING' && order.paymentStatus === 'PENDING' ? (
            <TransferForm orderId={order.id} total={order.total} />
          ) : null}
          <OrderItemsForm
            orderId={order.id}
            items={order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              colorName: item.colorName,
              size: item.size,
              sku: item.sku,
            }))}
            availableVariants={availableVariants}
          />
          <OrderStatusForm orderId={order.id} status={order.status} />
          <TrackingForm
            orderId={order.id}
            carrier={order.shippingCarrier}
            trackingNumber={order.trackingNumber}
            isShipped={order.status === 'SHIPPED' || order.status === 'DELIVERED'}
          />
          <OrderNoteForm orderId={order.id} note={order.adminNote} />
          <RefundForm
            orderId={order.id}
            total={order.total}
            canRefund={order.paymentStatus === 'APPROVED' && Boolean(order.mpPaymentId)}
          />
        </div>
      </div>
    </>
  );
}
