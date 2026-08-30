import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatCLP } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import { ORDER_STATUS_LABEL, orderStatusTone } from '@/lib/orders';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import { CustomerRoleForm } from '@/components/admin/CustomerRoleForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Cliente', noIndex: true });

export default async function AdminCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { addresses: { orderBy: { isDefault: 'desc' } } },
  });
  if (!user) notFound();

  const [orders, stats, topSizes] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { quantity: true, size: true } } },
    }),
    prisma.order.aggregate({
      where: { OR: [{ userId: user.id }, { email: user.email }], paymentStatus: 'APPROVED' },
      _sum: { total: true },
      _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ['size'],
      where: { order: { OR: [{ userId: user.id }, { email: user.email }], paymentStatus: 'APPROVED' } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 3,
    }),
  ]);

  const average = stats._count > 0 ? Math.round((stats._sum.total ?? 0) / stats._count) : 0;

  return (
    <>
      <PageHeader
        title={`${user.name} ${user.lastName ?? ''}`.trim()}
        description={`${user.email}${user.phone ? ` · ${user.phone}` : ''}${user.clubName ? ` · ${user.clubName}` : ''}`}
        back={{ href: '/admin/clientes', label: 'Clientes' }}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pedidos pagados" value={String(stats._count)} />
        <StatCard label="Total comprado" value={formatCLP(stats._sum.total ?? 0)} tone="accent" />
        <StatCard label="Ticket promedio" value={formatCLP(average)} />
        <StatCard
          label="Talla habitual"
          value={topSizes[0]?.size ?? '—'}
          hint={topSizes.length > 1 ? `También compra ${topSizes.slice(1).map((s) => s.size).join(', ')}` : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card title={`Pedidos (${orders.length})`} padded={false}>
          <Table minWidth={560}>
            <thead>
              <tr>
                <Th>Pedido</Th>
                <Th>Fecha</Th>
                <Th>Estado</Th>
                <Th align="center">Ítems</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <Link href={`/admin/pedidos/${order.id}`} className="text-chalk hover:accent-text">
                      {order.number}
                    </Link>
                  </Td>
                  <Td>{formatDate(order.createdAt)}</Td>
                  <Td><Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge></Td>
                  <Td align="center">{order.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                  <Td align="right" className="font-medium text-chalk">{formatCLP(order.total)}</Td>
                </Tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13.5px] text-chalk-faint">
                    Este cliente todavía no tiene pedidos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-5">
          <Card title="Datos de la cuenta">
            <dl className="space-y-3 text-[13.5px]">
              {[
                ['Correo', user.email],
                ['Teléfono', user.phone ?? '—'],
                ['RUT', user.rut ?? '—'],
                ['Club', user.clubName ?? '—'],
                ['Registro', formatDate(user.createdAt)],
                ['Último ingreso', user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'],
                ['Comunicaciones', user.acceptsMarketing ? 'Aceptadas' : 'No aceptadas'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-chalk-faint">{label}</dt>
                  <dd className="text-right text-chalk-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Direcciones" padded={false}>
            {user.addresses.length === 0 ? (
              <p className="p-5 text-[13px] text-chalk-faint">Sin direcciones guardadas.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {user.addresses.map((address) => (
                  <li key={address.id} className="px-5 py-3.5">
                    <p className="flex items-center gap-2 text-[13px] text-chalk">
                      {address.label || 'Dirección'}
                      {address.isDefault ? <Badge tone="accent">Principal</Badge> : null}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-faint">
                      {address.street} {address.number}
                      {address.extra ? `, ${address.extra}` : ''}<br />
                      {address.commune}, {regionName(address.region)}<br />
                      {address.phone}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {admin.role === 'ADMIN' && admin.id !== user.id ? (
            <Card title="Permisos" description="Define qué puede hacer esta persona en el panel.">
              <CustomerRoleForm userId={user.id} role={user.role} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
