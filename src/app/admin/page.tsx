import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { dailySales, rangeFor, salesSummary, topProducts, topSizes } from '@/lib/reports';
import { getLowStock } from '@/lib/inventory';
import { ORDER_STATUS_LABEL, orderStatusTone } from '@/lib/orders';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { SalesChart, type SalesPoint } from '@/components/admin/SalesChart';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { IconAlert, IconPlus } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Resumen', noIndex: true });

const dayFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

export default async function AdminDashboard() {
  const today = rangeFor('hoy');
  const week = rangeFor('semana');
  const month = rangeFor('mes');
  const last30 = rangeFor('30d');

  const [
    todayStats, weekStats, monthStats,
    series, recentOrders, lowStock, pendingCount, bestProducts, bestSizes, quotes,
  ] = await Promise.all([
    salesSummary(today.from, today.to),
    salesSummary(week.from, week.to),
    salesSummary(month.from, month.to),
    dailySales(last30.from, last30.to),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    getLowStock(8),
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    topProducts(month.from, month.to, 5),
    topSizes(month.from, month.to),
    prisma.quoteRequest.count({ where: { status: 'NEW' } }),
  ]);

  // Rellena los días sin ventas para que la serie no tenga saltos.
  const byDay = new Map(series.map((s) => [s.day.toISOString().slice(0, 10), s]));
  const points: SalesPoint[] = [];
  for (let d = new Date(last30.from); d <= last30.to; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const found = byDay.get(iso);
    points.push({
      iso,
      label: dayFmt.format(d),
      total: found?.total ?? 0,
      orders: found?.orders ?? 0,
    });
  }

  const maxSizeUnits = Math.max(1, ...bestSizes.map((s) => s.units));

  return (
    <>
      <PageHeader
        title="Resumen"
        description="Ventas, pedidos por preparar y alertas de inventario."
        actions={
          <>
            <ButtonLink href="/admin/productos/nuevo" size="sm">
              <IconPlus className="h-4 w-4" />
              Nuevo producto
            </ButtonLink>
            <ButtonLink href="/admin/pedidos" variant="outline" size="sm">Ver pedidos</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas de hoy"
          value={formatCLP(todayStats.revenue)}
          hint={`${todayStats.orders} ${todayStats.orders === 1 ? 'pedido' : 'pedidos'} · ${todayStats.units} unidades`}
          tone="accent"
        />
        <StatCard
          label="Esta semana"
          value={formatCLP(weekStats.revenue)}
          hint={`${weekStats.orders} pedidos · ticket ${formatCLP(weekStats.average)}`}
        />
        <StatCard
          label="Este mes"
          value={formatCLP(monthStats.revenue)}
          hint={`${monthStats.orders} pedidos · ${monthStats.units} unidades`}
        />
        <StatCard
          label="Por preparar"
          value={String(pendingCount)}
          hint={pendingCount > 0 ? 'Pedidos pagados esperando despacho' : 'Todo al día'}
          tone={pendingCount > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Ventas de los últimos 30 días" description={`Total ${formatCLP(points.reduce((s, p) => s + p.total, 0))}`}>
          <SalesChart points={points} />
        </Card>

        <Card
          title="Stock bajo"
          description={lowStock.length > 0 ? 'SKU que necesitan reposición' : 'Sin alertas'}
          actions={
            <Link href="/admin/inventario" className="font-display text-[10.5px] uppercase tracking-widest accent-text">
              Ver todo
            </Link>
          }
          padded={false}
        >
          {lowStock.length === 0 ? (
            <p className="p-5 text-[13px] text-chalk-faint">
              Ningún SKU está por debajo de su umbral. Buen momento para publicar.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {lowStock.map((row) => (
                <li key={row.variantId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-chalk">
                      {row.productName} · {row.colorName}
                    </p>
                    <p className="font-mono text-[11px] text-chalk-faint">{row.sku}</p>
                  </div>
                  <span
                    className={`shrink-0 font-display text-[15px] font-bold ${
                      row.stock === 0 ? 'text-signal-bad' : 'text-signal-warn'
                    }`}
                  >
                    {row.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card
          title="Últimos pedidos"
          actions={
            <Link href="/admin/pedidos" className="font-display text-[10.5px] uppercase tracking-widest accent-text">
              Ver todos
            </Link>
          }
          padded={false}
        >
          <Table minWidth={620}>
            <thead>
              <tr>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
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
                    <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                  </Td>
                  <Td align="right" className="font-display font-semibold text-chalk">
                    {formatCLP(order.total)}
                  </Td>
                </Tr>
              ))}
              {recentOrders.length === 0 ? (
                <tr>
                  <Td className="py-8 text-center text-chalk-faint">Todavía no hay pedidos.</Td>
                  <Td /><Td /><Td />
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-5">
          <Card title="Más vendidos del mes" padded={false}>
            {bestProducts.length === 0 ? (
              <p className="p-5 text-[13px] text-chalk-faint">Sin ventas registradas este mes.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {bestProducts.map((product) => (
                  <li key={product.name} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="truncate text-[13px] text-chalk">{product.name}</span>
                    <span className="shrink-0 text-[13px] text-chalk-faint">
                      {product.units} u. · {formatCLP(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tallas más vendidas del mes">
            {bestSizes.length === 0 ? (
              <p className="text-[13px] text-chalk-faint">Sin datos todavía.</p>
            ) : (
              <ul className="space-y-2">
                {bestSizes.slice(0, 9).map((size) => (
                  <li key={size.size} className="flex items-center gap-3">
                    <span className="w-8 shrink-0 font-display text-[13px] font-bold text-chalk">
                      {size.size}
                    </span>
                    <span className="h-2 flex-1 bg-ink-700">
                      <span
                        className="block h-full accent-bg"
                        style={{ width: `${(size.units / maxSizeUnits) * 100}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[12.5px] text-chalk-faint">
                      {size.units}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {quotes > 0 ? (
            <Link
              href="/admin/cotizaciones"
              className="flex items-center gap-3 border border-signal-warn/40 bg-signal-warn/10 px-5 py-4 text-signal-warn transition-colors hover:bg-signal-warn/15"
            >
              <IconAlert className="h-5 w-5 shrink-0" />
              <span className="text-[13.5px]">
                {quotes} {quotes === 1 ? 'cotización nueva de club' : 'cotizaciones nuevas de clubes'} sin responder
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-[11.5px] text-chalk-faint">
        Los montos consideran solo pedidos con pago aprobado. Actualizado al {formatDate(new Date())}.
      </p>
    </>
  );
}
