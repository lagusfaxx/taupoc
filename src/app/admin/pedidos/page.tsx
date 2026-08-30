import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import {
  ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, orderStatusTone, paymentStatusTone,
} from '@/lib/orders';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { StatCard } from '@/components/admin/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Pedidos', noIndex: true });

const PER_PAGE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;

  const page = Math.max(1, Number(one('pagina') ?? 1) || 1);
  const query = one('q')?.trim();
  const status = one('estado');
  const payment = one('pago');

  const where: Prisma.OrderWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { trackingNumber: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(payment ? { paymentStatus: payment as never } : {}),
  };

  const [orders, total, pending, processing, todayRevenue] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.count({ where }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.count({ where: { status: 'PROCESSING' } }),
    prisma.order.aggregate({
      where: {
        paymentStatus: 'APPROVED',
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { total: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Gestiona el estado, el despacho y el seguimiento de cada pedido."
        actions={
          <ButtonLink href="/api/admin/export/pedidos" variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pedidos totales" value={String(total)} />
        <StatCard label="Pagados por preparar" value={String(pending)} tone={pending > 0 ? 'warn' : 'ok'} />
        <StatCard label="En preparación" value={String(processing)} tone="info" />
        <StatCard label="Ventas de hoy" value={formatCLP(todayRevenue._sum.total ?? 0)} tone="accent" />
      </div>

      <Toolbar
        searchPlaceholder="Buscar por número, cliente, correo o seguimiento…"
        filters={[
          {
            name: 'estado',
            label: 'Todos los estados',
            options: Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            name: 'pago',
            label: 'Todos los pagos',
            options: Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <div className="border border-line bg-ink-900">
        <Table minWidth={900}>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Cliente</Th>
              <Th>Entrega</Th>
              <Th>Estado</Th>
              <Th>Pago</Th>
              <Th align="center">Ítems</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>
                  <Link href={`/admin/pedidos/${order.id}`} className="font-medium text-chalk hover:accent-text">
                    {order.number}
                  </Link>
                  <p className="text-[11.5px] text-chalk-faint">{formatDateTime(order.createdAt)}</p>
                </Td>
                <Td>
                  <p className="truncate text-chalk">{order.firstName} {order.lastName}</p>
                  <p className="truncate text-[11.5px] text-chalk-faint">{order.email}</p>
                </Td>
                <Td>
                  <p className="truncate text-[13px]">{order.shippingLabel ?? '—'}</p>
                  <p className="truncate text-[11.5px] text-chalk-faint">
                    {order.isPickup ? 'Retiro' : `${order.commune ?? ''}${order.region ? `, ${regionName(order.region)}` : ''}`}
                  </p>
                </Td>
                <Td><Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge></Td>
                <Td><Badge tone={paymentStatusTone(order.paymentStatus)}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge></Td>
                <Td align="center">{order.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                <Td align="right" className="font-display font-semibold text-chalk">{formatCLP(order.total)}</Td>
              </Tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[13.5px] text-chalk-faint">
                  No hay pedidos que coincidan con la búsqueda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>

      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />
    </>
  );
}
