import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatCLP } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import {
  couponUsage, dailySales, rangeFor, salesByRegion, salesSummary, topColors, topSizes,
} from '@/lib/reports';
import {
  DEVICE_LABEL, METHOD_LABEL, SOURCE_LABEL, abandonedCarts, buyingMoments, customerMix, delta,
  devices, fillDays, fulfillment, funnel, inventoryCoverage, paymentMix, pct, previousRange,
  productPerformance, storefrontMix, topCustomers, trafficSources,
} from '@/lib/analytics';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { BarList, FunnelBars, Insight, Kpi } from '@/components/admin/Stats';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { SalesChart, type SalesPoint } from '@/components/admin/SalesChart';
import { PeriodPicker } from '@/components/admin/PeriodPicker';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Estadísticas', noIndex: true });

const PERIODS = ['hoy', 'semana', 'mes', '30d', '90d', 'anio'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  anio: 'Este año',
};

const num = (v: number) => v.toLocaleString('es-CL');
const percent = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="font-display text-[18px] leading-none tracking-tight text-chalk">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-chalk-faint">{lead}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-chalk-faint">{children}</td></tr>
);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const raw = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo;
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : '30d';
  const { from, to } = rangeFor(period);
  const prev = previousRange(from, to);

  const [
    summary, prevSummary, series, prevSeries, embudo, prevEmbudo, sources, byDevice, products,
    customers, bestCustomers, payments, stores, moments, carts, coverage, ops,
    sizes, colors, regions, coupons, unpaid,
  ] = await Promise.all([
    salesSummary(from, to),
    salesSummary(prev.from, prev.to),
    dailySales(from, to),
    dailySales(prev.from, prev.to),
    funnel(from, to),
    funnel(prev.from, prev.to),
    trafficSources(from, to),
    devices(from, to),
    productPerformance(from, to),
    customerMix(from, to),
    topCustomers(from, to),
    paymentMix(from, to),
    storefrontMix(from, to),
    buyingMoments(from, to),
    abandonedCarts(8),
    inventoryCoverage(),
    fulfillment(from, to),
    topSizes(from, to),
    topColors(from, to, 10),
    salesByRegion(from, to),
    couponUsage(from, to),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to }, paymentStatus: { in: ['PENDING', 'REJECTED'] } } }),
  ]);

  const points: SalesPoint[] = fillDays(from, to, series).map((d) => ({
    iso: d.iso, label: d.label, total: d.row?.total ?? 0, orders: d.row?.orders ?? 0,
  }));
  const previous = fillDays(prev.from, prev.to, prevSeries).map((d) => d.row?.total ?? 0);

  const conversion = pct(embudo.paidOrders, embudo.sessions);
  const prevConversion = pct(prevEmbudo.paidOrders, prevEmbudo.sessions);
  const measuring = embudo.sessions > 0;
  const partial = embudo.trackingSince && embudo.trackingSince > from;
  const cartRate = pct(embudo.carts, embudo.productSessions);
  const checkoutRate = pct(embudo.paidOrders, embudo.checkoutSessions);

  const bestDay = [...moments.weekdays].sort((a, b) => b.orders - a.orders)[0];
  const bestBlock = [...moments.blocks].sort((a, b) => b.orders - a.orders)[0];
  const outPct = pct(coverage.skusOut, coverage.skus);
  const urgent = coverage.rows.filter((r) => r.daysCover != null && r.daysCover <= 21);
  const idle = coverage.rows.filter((r) => r.sold30 === 0 && r.stock > 0);

  return (
    <>
      <PageHeader
        title="Estadísticas"
        description={`${PERIOD_LABEL[period]} · comparado con el período anterior del mismo largo.`}
        actions={
          <ButtonLink href={`/api/admin/export/ventas?periodo=${period}`} variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar ventas
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker periods={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} current={period} />
        <nav aria-label="Secciones" className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-chalk-dim">
          {[
            ['#embudo', 'Embudo'], ['#productos', 'Productos'], ['#clientes', 'Clientes'],
            ['#pagos', 'Pagos'], ['#inventario', 'Inventario'], ['#detalle', 'Tallas y regiones'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="underline-offset-4 hover:text-chalk hover:underline">{label}</a>
          ))}
        </nav>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Ingresos"
          value={formatCLP(summary.revenue)}
          delta={delta(summary.revenue, prevSummary.revenue)}
          hint={`Productos ${formatCLP(summary.subtotal)} · despacho ${formatCLP(summary.shipping)} · descuentos −${formatCLP(summary.discounts)}`}
        />
        <Kpi
          label="Pedidos pagados"
          value={num(summary.orders)}
          delta={delta(summary.orders, prevSummary.orders)}
          hint={`${summary.units} unidades · ${unpaid} pedidos sin pagar o rechazados`}
        />
        <Kpi label="Ticket promedio" value={formatCLP(summary.average)} delta={delta(summary.average, prevSummary.average)} />
        <Kpi
          label="Conversión"
          value={measuring ? percent(conversion) : '—'}
          delta={measuring ? delta(conversion, prevConversion) : null}
          showDelta={measuring}
          hint={measuring ? `${num(embudo.sessions)} visitas · ${num(embudo.paidOrders)} pedidos web pagados` : 'Aún sin visitas medidas'}
        />
      </div>

      <div className="mt-5">
        <Card title="Evolución de ventas">
          <SalesChart points={points} previous={previous} />
        </Card>
      </div>

      <Section
        id="embudo"
        title="Embudo y tráfico"
        lead="De cada 100 visitas, cuántas llegan a comprar y en qué paso se van. Sirve para decidir si el problema es atraer gente o convencerla."
      >
        {measuring ? (
          <>
            {partial ? (
              <p className="mb-4 border border-line bg-ink-900 px-4 py-3 text-[12.5px] text-chalk-dim">
                Las visitas se miden desde el {formatDate(embudo.trackingSince)}: en este período el embudo cubre
                solo desde esa fecha, mientras que las ventas cubren el período completo.
              </p>
            ) : null}
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <Card title="Embudo de compra">
                <FunnelBars
                  steps={[
                    { label: 'Visitas', value: embudo.sessions, hint: `${num(embudo.visitors)} personas distintas` },
                    { label: 'Vieron un producto', value: embudo.productSessions },
                    { label: 'Agregaron al carrito', value: embudo.carts },
                    { label: 'Llegaron al pago', value: embudo.checkoutSessions },
                    { label: 'Pagaron', value: embudo.paidOrders, hint: `${num(embudo.orders)} pedidos creados en la web` },
                  ]}
                />
                <Insight>
                  {cartRate < 8 && embudo.productSessions >= 20
                    ? `Solo el ${percent(cartRate)} de quienes ven un producto lo agrega al carrito. Revisa stock de tallas, fotos y precio antes de invertir en más tráfico.`
                    : checkoutRate < 50 && embudo.checkoutSessions >= 10
                      ? `El ${percent(100 - checkoutRate)} de quienes llegan al pago no termina la compra. Revisa costo de despacho y medios de pago.`
                      : `De quienes ven un producto, el ${percent(cartRate)} lo agrega al carrito; de quienes llegan al pago, el ${percent(checkoutRate)} paga.`}
                </Insight>
              </Card>

              <div className="min-w-0 space-y-5">
                <Card title="De dónde llegan" description="Visitas, y pedidos que salieron de cada origen" padded={false}>
                  <Table minWidth={460}>
                    <thead>
                      <tr>
                        <Th>Origen</Th>
                        <Th align="right">Visitas</Th>
                        <Th align="right">Al pago</Th>
                        <Th align="right">Pedidos</Th>
                        <Th align="right">Conv.</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => (
                        <Tr key={s.source}>
                          <Td className="text-chalk">{SOURCE_LABEL[s.source] ?? s.source}</Td>
                          <Td align="right" className="tabular-nums">{num(s.sessions)}</Td>
                          <Td align="right" className="tabular-nums">{num(s.checkouts)}</Td>
                          <Td align="right" className="tabular-nums text-chalk">{num(s.orders)}</Td>
                          <Td align="right" className="tabular-nums">{percent(pct(s.orders, s.sessions))}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>

                <Card title="Dispositivo">
                  <BarList
                    rows={byDevice.map((d) => ({
                      key: d.device,
                      label: DEVICE_LABEL[d.device] ?? d.device,
                      value: d.sessions,
                      display: num(d.sessions),
                      sub: `${percent(pct(d.orders, d.sessions))} conv.`,
                    }))}
                  />
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card>
            <p className="max-w-2xl text-[13.5px] leading-relaxed text-chalk-dim">
              Todavía no hay visitas registradas en este período. La medición propia empieza a contar al publicar
              esta versión: no usa cookies ni servicios externos, excluye bots y al equipo con sesión iniciada.
              Para saber qué anuncio trae cada visita, usa enlaces con <code className="bg-ink-700 px-1 font-mono text-[12px]">utm_source</code> y{' '}
              <code className="bg-ink-700 px-1 font-mono text-[12px]">utm_campaign</code>.
            </p>
          </Card>
        )}

        <div className="mt-5">
          <Card
            title="Carritos abandonados"
            description={
              carts.count > 0
                ? `${carts.count} carritos con ${formatCLP(carts.value)} sin comprar en los últimos 30 días · ${carts.reachable} son de clientes con cuenta`
                : 'Carritos con productos que no terminaron en compra'
            }
            padded={false}
          >
            <Table minWidth={620}>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Qué dejó</Th>
                  <Th>Última actividad</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {carts.list.map((c) => (
                  <Tr key={c.cartId}>
                    <Td>
                      {c.customer ? (
                        <Link href={`/admin/clientes/${c.customer.id}`} className="text-chalk hover:underline">
                          {c.customer.name || c.customer.email}
                          <span className="block text-[11.5px] text-chalk-faint">{c.customer.email}</span>
                        </Link>
                      ) : (
                        <span className="text-chalk-faint">Visitante sin cuenta</span>
                      )}
                    </Td>
                    <Td className="max-w-[320px] truncate">{c.items}</Td>
                    <Td>{formatDate(c.updatedAt)}</Td>
                    <Td align="right" className="tabular-nums text-chalk">{formatCLP(c.value)}</Td>
                  </Tr>
                ))}
                {carts.list.length === 0 ? <Empty>Ningún carrito abandonado en los últimos 30 días.</Empty> : null}
              </tbody>
            </Table>
          </Card>
        </div>
      </Section>

      <Section
        id="productos"
        title="Rendimiento por producto"
        lead="Un producto muy visto que no se agrega al carrito tiene un problema de ficha, precio o tallas. Uno que vende con pocas visitas merece más exposición."
      >
        <Card padded={false}>
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th align="right">Visitas</Th>
                <Th align="right">Carritos</Th>
                <Th align="right">Vista → carrito</Th>
                <Th align="right">Unidades</Th>
                <Th align="right">Ingresos</Th>
                <Th align="right">Stock</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <Tr key={p.productId}>
                  <Td>
                    <Link href={`/admin/productos/${p.productId}`} className="text-chalk hover:underline">{p.name}</Link>
                  </Td>
                  <Td align="right" className="tabular-nums">{num(p.views)}</Td>
                  <Td align="right" className="tabular-nums">{num(p.carts)}</Td>
                  <Td align="right" className="tabular-nums">{p.views > 0 ? percent(pct(p.carts, p.views)) : '—'}</Td>
                  <Td align="right" className="tabular-nums">{num(p.units)}</Td>
                  <Td align="right" className="font-medium tabular-nums text-chalk">{formatCLP(p.revenue)}</Td>
                  <Td align="right" className={p.stock === 0 ? 'tabular-nums text-signal-bad' : 'tabular-nums'}>
                    {p.stock === 0 ? 'Agotado' : num(p.stock)}
                  </Td>
                </Tr>
              ))}
              {products.length === 0 ? <Empty>No hay productos publicados.</Empty> : null}
            </tbody>
          </Table>
        </Card>
      </Section>

      <Section
        id="clientes"
        title="Clientes"
        lead="Cuánto de la venta viene de gente nueva y cuánto de quienes ya compraron. La recompra es la venta más barata de conseguir."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Compradores" value={num(customers.buyers)} showDelta={false} hint="Personas distintas con un pedido pagado" />
          <Kpi
            label="Nuevos"
            value={num(customers.fresh)}
            showDelta={false}
            hint={`${formatCLP(customers.revenueNew)} · ${percent(pct(customers.fresh, customers.buyers))} de los compradores`}
          />
          <Kpi
            label="Recurrentes"
            value={num(customers.returning)}
            showDelta={false}
            hint={`${formatCLP(customers.revenueReturning)} · ya habían comprado antes`}
          />
          <Kpi
            label="Tasa de recompra histórica"
            value={percent(pct(customers.lifetimeRepeaters, customers.lifetimeCustomers))}
            showDelta={false}
            hint={`${num(customers.lifetimeRepeaters)} de ${num(customers.lifetimeCustomers)} clientes compraron más de una vez`}
          />
        </div>

        <div className="mt-5">
          <Card title="Mejores clientes del período" padded={false}>
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th align="center">Pedidos</Th>
                  <Th align="right">Total comprado</Th>
                </tr>
              </thead>
              <tbody>
                {bestCustomers.map((c) => (
                  <Tr key={c.email}>
                    <Td>
                      <span className="text-chalk">{c.name || c.email}</span>
                      {c.name ? <span className="block text-[11.5px] text-chalk-faint">{c.email}</span> : null}
                    </Td>
                    <Td align="center" className="tabular-nums">{c.orders}</Td>
                    <Td align="right" className="font-medium tabular-nums text-chalk">{formatCLP(c.total)}</Td>
                  </Tr>
                ))}
                {bestCustomers.length === 0 ? <Empty>Sin ventas en el período.</Empty> : null}
              </tbody>
            </Table>
          </Card>
        </div>
      </Section>

      <Section
        id="pagos"
        title="Pagos, canales y momentos"
        lead="Qué medio de pago se cae más, cuánto pesa cada tienda y cuándo compra la gente, para programar anuncios y publicaciones."
      >
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
          <Card title="Medios de pago" description="Aprobación = pedidos pagados sobre pedidos creados" padded={false}>
            <Table minWidth={460}>
              <thead>
                <tr>
                  <Th>Medio</Th>
                  <Th align="right">Creados</Th>
                  <Th align="right">Pagados</Th>
                  <Th align="right">Aprobación</Th>
                  <Th align="right">Ingresos</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <Tr key={p.method}>
                    <Td className="text-chalk">{METHOD_LABEL[p.method] ?? p.method}</Td>
                    <Td align="right" className="tabular-nums">{num(p.created)}</Td>
                    <Td align="right" className="tabular-nums">{num(p.paid)}</Td>
                    <Td align="right" className="tabular-nums">{percent(pct(p.paid, p.created))}</Td>
                    <Td align="right" className="font-medium tabular-nums text-chalk">{formatCLP(p.revenue)}</Td>
                  </Tr>
                ))}
                {payments.length === 0 ? <Empty>Sin pedidos en el período.</Empty> : null}
              </tbody>
            </Table>
          </Card>

          <Card title="Operación">
            <dl className="grid gap-5 sm:grid-cols-2">
              {[
                ['Tiempo de despacho', ops.shipHours != null ? (ops.shipHours < 48 ? `${ops.shipHours} h` : `${Math.round(ops.shipHours / 24)} días`) : '—', `Promedio desde el pago, en ${num(ops.shipped)} despachos`],
                ['Cambios y devoluciones', percent(ops.returnRate), `${num(ops.returns)} sobre los pedidos pagados`],
                ...stores.map((s) => [
                  s.storefront === 'INTL' ? 'taupoc.lat' : 'taupoc.cl',
                  formatCLP(s.revenue),
                  `${num(s.orders)} pedidos · ${percent(pct(s.revenue, summary.revenue))} de la venta`,
                ]),
              ].map(([label, value, hint]) => (
                <div key={label}>
                  <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">{label}</dt>
                  <dd className="mt-1.5 font-display text-[20px] font-bold tabular-nums text-chalk">{value}</dd>
                  <dd className="mt-1 text-[12px] text-chalk-faint">{hint}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Pedidos por día de la semana">
            <BarList
              labelWidth="w-12"
              rows={moments.weekdays.map((d) => ({
                key: d.label, label: d.label, value: d.orders, display: num(d.orders), sub: formatCLP(d.revenue),
              }))}
              empty="Sin ventas en el período."
            />
          </Card>

          <Card title="Pedidos por hora (Chile)">
            <BarList
              labelWidth="w-20"
              rows={moments.blocks.map((b) => ({
                key: b.label, label: b.label, value: b.orders, display: num(b.orders), sub: formatCLP(b.revenue),
              }))}
              empty="Sin ventas en el período."
            />
            {bestDay && bestDay.orders > 0 ? (
              <Insight>
                Se compra más los {bestDay.label.toLowerCase()} y entre las {bestBlock.label}. Son los mejores
                momentos para publicar y para concentrar el presupuesto de anuncios.
              </Insight>
            ) : null}
          </Card>
        </div>
      </Section>

      <Section
        id="inventario"
        title="Inventario"
        lead="Estado de hoy, sin importar el período: cuánta plata hay en stock, para cuántos días alcanza al ritmo de los últimos 30 días y qué está parado."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Unidades disponibles" value={num(coverage.units)} showDelta={false} />
          <Kpi label="Valor a precio de venta" value={formatCLP(coverage.value)} showDelta={false} />
          <Kpi
            label="Tallas agotadas"
            value={percent(outPct)}
            showDelta={false}
            hint={`${num(coverage.skusOut)} de ${num(coverage.skus)} combinaciones de color y talla publicadas`}
          />
          <Kpi
            label="Por reponer"
            value={num(urgent.length)}
            showDelta={false}
            hint={urgent.length > 0 ? 'Productos con stock para menos de 3 semanas' : 'Ningún producto con menos de 3 semanas de stock'}
          />
        </div>

        <div className="mt-5">
          <Card
            title="Cobertura por producto"
            actions={
              <Link href="/admin/tallas" className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:text-chalk">
                Demanda por talla
              </Link>
            }
            padded={false}
          >
            <Table minWidth={680}>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">Vendidas 30 d</Th>
                  <Th align="right">Alcanza para</Th>
                  <Th align="right">Tallas agotadas</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.map((r) => (
                  <Tr key={r.productId}>
                    <Td>
                      <Link href={`/admin/productos/${r.productId}`} className="text-chalk hover:underline">{r.name}</Link>
                    </Td>
                    <Td align="right" className="tabular-nums">{num(r.stock)}</Td>
                    <Td align="right" className="tabular-nums">{num(r.sold30)}</Td>
                    <Td
                      align="right"
                      className={
                        r.daysCover != null && r.daysCover <= 21 ? 'tabular-nums text-signal-warn' : 'tabular-nums'
                      }
                    >
                      {r.stock === 0 ? 'Agotado' : r.daysCover == null ? 'Sin ventas' : `${num(r.daysCover)} días`}
                    </Td>
                    <Td align="right" className="tabular-nums">{percent(pct(r.skusOut, r.skus))}</Td>
                    <Td align="right" className="tabular-nums text-chalk">{formatCLP(r.value)}</Td>
                  </Tr>
                ))}
                {coverage.rows.length === 0 ? <Empty>No hay productos activos con inventario.</Empty> : null}
              </tbody>
            </Table>
          </Card>
          {idle.length > 0 ? (
            <Insight>
              Sin ventas en 30 días y con stock: {idle.map((r) => r.name).join(', ')}. Son{' '}
              {formatCLP(idle.reduce((s, r) => s + r.value, 0))} parados; evalúa un cupón, un destacado en la
              portada o un anuncio.
            </Insight>
          ) : null}
        </div>
      </Section>

      <Section
        id="detalle"
        title="Tallas, colores, regiones y cupones"
        lead="El desglose de lo vendido en el período."
      >
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
          <Card title="Tallas más vendidas">
            <BarList
              labelWidth="w-10"
              rows={sizes.map((s) => ({ key: s.size, label: s.size, value: s.units, display: `${num(s.units)} u.` }))}
              empty="Sin ventas en el período."
            />
          </Card>

          <Card title="Colores más vendidos">
            <BarList
              labelWidth="w-32"
              rows={colors.map((c) => ({ key: c.color, label: c.color, value: c.units, display: `${num(c.units)} u.` }))}
              empty="Sin ventas en el período."
            />
          </Card>

          <Card title="Ventas por región" padded={false}>
            <Table minWidth={420}>
              <thead>
                <tr>
                  <Th>Región</Th>
                  <Th align="center">Pedidos</Th>
                  <Th align="right">Ingresos</Th>
                </tr>
              </thead>
              <tbody>
                {regions.map((region) => (
                  <Tr key={region.region ?? 'retiro'}>
                    <Td className="text-chalk">{region.region ? regionName(region.region) : 'Retiro / entrega presencial'}</Td>
                    <Td align="center" className="tabular-nums">{region.orders}</Td>
                    <Td align="right" className="font-medium tabular-nums text-chalk">{formatCLP(region.revenue)}</Td>
                  </Tr>
                ))}
                {regions.length === 0 ? <Empty>Sin ventas en el período.</Empty> : null}
              </tbody>
            </Table>
          </Card>

          <Card title="Uso de cupones" padded={false}>
            <Table minWidth={460}>
              <thead>
                <tr>
                  <Th>Cupón</Th>
                  <Th align="center">Pedidos</Th>
                  <Th align="right">Descuento</Th>
                  <Th align="right">Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <Tr key={coupon.code}>
                    <Td className="font-mono text-chalk">{coupon.code}</Td>
                    <Td align="center" className="tabular-nums">{coupon.orders}</Td>
                    <Td align="right" className="tabular-nums">−{formatCLP(coupon.discount)}</Td>
                    <Td align="right" className="font-medium tabular-nums text-chalk">{formatCLP(coupon.revenue)}</Td>
                  </Tr>
                ))}
                {coupons.length === 0 ? <Empty>Ningún pedido usó cupón en el período.</Empty> : null}
              </tbody>
            </Table>
          </Card>
        </div>
      </Section>
    </>
  );
}
