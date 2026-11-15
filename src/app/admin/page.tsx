import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { dailySales, rangeFor, salesSummary, topProducts } from '@/lib/reports';
import {
  abandonedCarts, dailySessions, delta, fillDays, funnel, operations, pct, previousRange,
} from '@/lib/analytics';
import { getLowStock } from '@/lib/inventory';
import { ORDER_STATUS_LABEL, orderStatusTone } from '@/lib/orders';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { ActionItem, FunnelBars, Insight, Kpi } from '@/components/admin/Stats';
import { SalesChart, type SalesPoint } from '@/components/admin/SalesChart';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Resumen', noIndex: true });

const more = 'font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:text-chalk';

export default async function AdminDashboard() {
  const today = rangeFor('hoy');
  const last30 = rangeFor('30d');
  const prev30 = previousRange(last30.from, last30.to);

  const [
    todayStats, stats, prevStats, series, prevSeries, sessions, embudo, prevEmbudo,
    ops, carts, recentOrders, lowStock, bestProducts,
  ] = await Promise.all([
    salesSummary(today.from, today.to),
    salesSummary(last30.from, last30.to),
    salesSummary(prev30.from, prev30.to),
    dailySales(last30.from, last30.to),
    dailySales(prev30.from, prev30.to),
    dailySessions(last30.from, last30.to),
    funnel(last30.from, last30.to),
    funnel(prev30.from, prev30.to),
    operations(),
    abandonedCarts(0),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 7 }),
    getLowStock(6),
    topProducts(last30.from, last30.to, 5),
  ]);

  const days = fillDays(last30.from, last30.to, series);
  const points: SalesPoint[] = days.map((d) => ({
    iso: d.iso, label: d.label, total: d.row?.total ?? 0, orders: d.row?.orders ?? 0,
  }));
  const previous = fillDays(prev30.from, prev30.to, prevSeries).map((d) => d.row?.total ?? 0);
  const visitSpark = fillDays(last30.from, last30.to, sessions).map((d) => d.row?.sessions ?? 0);

  const conversion = pct(embudo.paidOrders, embudo.sessions);
  const prevConversion = pct(prevEmbudo.paidOrders, prevEmbudo.sessions);
  const measuring = embudo.sessions > 0;
  const pendientes = ops.toPrepare + ops.transfers + ops.quotes + ops.returnsOpen + lowStock.length;

  // La etapa donde se pierde más gente es la que conviene mirar primero.
  const etapas = [
    { label: 'Visitas', value: embudo.sessions },
    { label: 'Vieron un producto', value: embudo.productSessions },
    { label: 'Agregaron al carrito', value: embudo.carts },
    { label: 'Llegaron al pago', value: embudo.checkoutSessions },
    { label: 'Pagaron', value: embudo.paidOrders },
  ];
  let fuga: { de: string; a: string; pasa: number } | null = null;
  for (let i = 1; i < etapas.length; i++) {
    if (etapas[i - 1].value < 5) continue;
    const pasa = pct(etapas[i].value, etapas[i - 1].value);
    if (!fuga || pasa < fuga.pasa) fuga = { de: etapas[i - 1].label.toLowerCase(), a: etapas[i].label.toLowerCase(), pasa };
  }

  return (
    <>
      <PageHeader
        title="Resumen"
        description="Cómo va la tienda en los últimos 30 días y qué hay que atender hoy."
        actions={
          <>
            <ButtonLink href="/admin/pedidos/nuevo" size="sm">
              <IconPlus className="h-4 w-4" />
              Nuevo pedido
            </ButtonLink>
            <ButtonLink href="/admin/reportes" variant="outline" size="sm">Ver estadísticas</ButtonLink>
          </>
        }
      />

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card
          title="Para atender hoy"
          description={pendientes > 0 ? 'Ordenado por lo que frena una venta o una entrega.' : undefined}
          padded={false}
        >
          {pendientes === 0 ? (
            <p className="p-5 text-[13.5px] text-chalk-dim">Nada pendiente. Pedidos, transferencias y stock al día.</p>
          ) : (
            <div>
              {ops.transfers > 0 ? (
                <ActionItem
                  href="/admin/pedidos?metodo=TRANSFER&pago=PENDING&estado=PENDING"
                  count={ops.transfers}
                  label="Transferencias por confirmar"
                  detail={`${formatCLP(ops.transfersAmount)} esperando que revises el abono`}
                />
              ) : null}
              {ops.toPrepare > 0 ? (
                <ActionItem
                  href="/admin/pedidos?estado=PAID"
                  count={ops.toPrepare}
                  label="Pedidos pagados por despachar"
                  detail={ops.late > 0 ? `${ops.late} llevan más de 48 horas esperando` : 'Todos dentro de las 48 horas'}
                  tone={ops.late > 0 ? 'bad' : 'warn'}
                />
              ) : null}
              {ops.quotes > 0 ? (
                <ActionItem href="/admin/cotizaciones" count={ops.quotes} label="Cotizaciones de clubes sin responder" tone="info" />
              ) : null}
              {ops.returnsOpen > 0 ? (
                <ActionItem href="/admin/pedidos" count={ops.returnsOpen} label="Cambios o devoluciones en curso" tone="info" />
              ) : null}
              {lowStock.length > 0 ? (
                <ActionItem
                  href="/admin/inventario"
                  count={lowStock.length >= 6 ? '6+' : lowStock.length}
                  label="Tallas con stock bajo o agotadas"
                  detail={lowStock.slice(0, 2).map((r) => `${r.productName} ${r.colorName} T${r.size}`).join(' · ')}
                />
              ) : null}
            </div>
          )}
        </Card>

        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          <Kpi
            label="Ventas de hoy"
            value={formatCLP(todayStats.revenue)}
            showDelta={false}
            hint={`${todayStats.orders} ${todayStats.orders === 1 ? 'pedido' : 'pedidos'} · ${todayStats.units} ${todayStats.units === 1 ? 'unidad' : 'unidades'}`}
          />
          <Kpi
            label="Ingresos · 30 días"
            value={formatCLP(stats.revenue)}
            delta={delta(stats.revenue, prevStats.revenue)}
            hint={`${stats.orders} pedidos · ${stats.units} unidades`}
          />
          <Kpi
            label="Ticket promedio"
            value={formatCLP(stats.average)}
            delta={delta(stats.average, prevStats.average)}
          />
          <Kpi
            label="Visitas · 30 días"
            value={embudo.sessions.toLocaleString('es-CL')}
            delta={delta(embudo.sessions, prevEmbudo.sessions)}
            spark={visitSpark}
            hint={`${embudo.visitors.toLocaleString('es-CL')} personas distintas`}
          />
          <Kpi
            label="Conversión"
            value={measuring ? `${conversion.toLocaleString('es-CL')}%` : '—'}
            delta={measuring ? delta(conversion, prevConversion) : null}
            showDelta={measuring}
            hint={measuring ? 'Pedidos pagados por cada 100 visitas' : 'Se calcula cuando haya visitas medidas'}
          />
          <Kpi
            label="Carritos abandonados"
            value={String(carts.count)}
            showDelta={false}
            hint={
              carts.count > 0
                ? `${formatCLP(carts.value)} sin comprar · ${carts.reachable} con cuenta para contactar`
                : 'Ninguno en los últimos 30 días'
            }
          />
        </div>
      </div>

      <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          title="Ventas diarias"
          description={`${formatCLP(stats.revenue)} en 30 días · ${formatCLP(prevStats.revenue)} en los 30 anteriores`}
        >
          <SalesChart points={points} previous={previous} />
        </Card>

        <Card
          title="Embudo de compra"
          description="Últimos 30 días"
          actions={<Link href="/admin/reportes#embudo" className={more}>Ver detalle</Link>}
        >
          {measuring ? (
            <>
              <FunnelBars steps={etapas} />
              {fuga ? (
                <Insight>
                  La mayor pérdida está entre «{fuga.de}» y «{fuga.a}»: solo pasa el{' '}
                  {fuga.pasa.toLocaleString('es-CL')}%. Es la etapa que más conviene mejorar.
                </Insight>
              ) : null}
            </>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-chalk-dim">
              La tienda empezó a medir sus visitas con esta versión. En cuanto entren las primeras, acá vas a
              ver cuántas personas miran un producto, lo agregan al carrito, llegan al pago y compran.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          title="Últimos pedidos"
          actions={<Link href="/admin/pedidos" className={more}>Ver todos</Link>}
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
                    <Link href={`/admin/pedidos/${order.id}`} className="font-medium text-chalk hover:underline">
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
                  <Td align="right" className="font-display font-semibold tabular-nums text-chalk">
                    {formatCLP(order.total)}
                  </Td>
                </Tr>
              ))}
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[13.5px] text-chalk-faint">
                    Todavía no hay pedidos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card
          title="Más vendidos · 30 días"
          actions={<Link href="/admin/reportes#productos" className={more}>Ver productos</Link>}
          padded={false}
        >
          {bestProducts.length === 0 ? (
            <p className="p-5 text-[13px] text-chalk-faint">Sin ventas en los últimos 30 días.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {bestProducts.map((product) => (
                <li key={product.name} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="truncate text-[13px] text-chalk">{product.name}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-chalk-dim">
                    {product.units} u. · {formatCLP(product.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-[11.5px] text-chalk-faint">
        Los montos consideran solo pedidos con pago aprobado. Las visitas excluyen bots y al equipo con sesión iniciada.
      </p>
    </>
  );
}
