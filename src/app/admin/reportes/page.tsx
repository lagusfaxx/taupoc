import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatCLP } from '@/lib/money';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import {
  couponUsage, dailySales, rangeFor, salesByRegion, salesSummary,
  topColors, topProducts, topSizes,
} from '@/lib/reports';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { SalesChart, type SalesPoint } from '@/components/admin/SalesChart';
import { PeriodPicker } from '@/components/admin/PeriodPicker';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Reportes', noIndex: true });

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

const dayFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

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

  const [summary, series, products, sizes, colors, regions, coupons, unpaid] = await Promise.all([
    salesSummary(from, to),
    dailySales(from, to),
    topProducts(from, to, 12),
    topSizes(from, to),
    topColors(from, to, 12),
    salesByRegion(from, to),
    couponUsage(from, to),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to }, paymentStatus: { in: ['PENDING', 'REJECTED'] } } }),
  ]);

  const byDay = new Map(series.map((s) => [s.day.toISOString().slice(0, 10), s]));
  const points: SalesPoint[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const found = byDay.get(iso);
    points.push({ iso, label: dayFmt.format(d), total: found?.total ?? 0, orders: found?.orders ?? 0 });
  }

  const maxSize = Math.max(1, ...sizes.map((s) => s.units));
  const maxColor = Math.max(1, ...colors.map((c) => c.units));

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Ventas con pago aprobado · ${PERIOD_LABEL[period]}`}
        actions={
          <ButtonLink href={`/api/admin/export/ventas?periodo=${period}`} variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </ButtonLink>
        }
      />

      <PeriodPicker periods={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} current={period} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos" value={formatCLP(summary.revenue)} tone="accent" />
        <StatCard label="Pedidos" value={String(summary.orders)} hint={`${unpaid} sin pagar en el período`} />
        <StatCard label="Unidades vendidas" value={String(summary.units)} />
        <StatCard label="Ticket promedio" value={formatCLP(summary.average)} />
      </div>

      <div className="mt-5">
        <Card title="Evolución de ventas">
          <SalesChart points={points} />
          <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
            {[
              ['Subtotal productos', formatCLP(summary.subtotal)],
              ['Descuentos aplicados', `−${formatCLP(summary.discounts)}`],
              ['Cobrado por despacho', formatCLP(summary.shipping)],
              ['Total facturado', formatCLP(summary.revenue)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">{label}</dt>
                <dd className="mt-1.5 font-display text-[17px] font-bold text-chalk">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
        <Card title="Productos más vendidos" padded={false}>
          <Table minWidth={420}>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th align="center">Unidades</Th>
                <Th align="right">Ingresos</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <Tr key={product.name}>
                  <Td className="text-chalk">{product.name}</Td>
                  <Td align="center">{product.units}</Td>
                  <Td align="right" className="font-medium text-chalk">{formatCLP(product.revenue)}</Td>
                </Tr>
              ))}
              {products.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-[13px] text-chalk-faint">Sin ventas en el período.</td></tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card title="Tallas más vendidas" description="Es el dato que define qué reponer.">
          {sizes.length === 0 ? (
            <p className="text-[13px] text-chalk-faint">Sin ventas en el período.</p>
          ) : (
            <ul className="space-y-2.5">
              {sizes.map((size) => (
                <li key={size.size} className="flex items-center gap-3">
                  <span className="w-9 shrink-0 font-display text-[15px] font-bold text-chalk">{size.size}</span>
                  <span className="h-2.5 flex-1 bg-ink-700">
                    <span className="block h-full accent-bg" style={{ width: `${(size.units / maxSize) * 100}%` }} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-[13px] text-chalk-dim">{size.units}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Colores más vendidos">
          {colors.length === 0 ? (
            <p className="text-[13px] text-chalk-faint">Sin ventas en el período.</p>
          ) : (
            <ul className="space-y-2.5">
              {colors.map((color) => (
                <li key={color.color} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-[13px] text-chalk-dim">{color.color}</span>
                  <span className="h-2.5 flex-1 bg-ink-700">
                    <span className="block h-full accent-bg" style={{ width: `${(color.units / maxColor) * 100}%` }} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-[13px] text-chalk-dim">{color.units}</span>
                </li>
              ))}
            </ul>
          )}
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
                  <Td align="center">{region.orders}</Td>
                  <Td align="right" className="font-medium text-chalk">{formatCLP(region.revenue)}</Td>
                </Tr>
              ))}
              {regions.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-[13px] text-chalk-faint">Sin ventas en el período.</td></tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>

      {coupons.length > 0 ? (
        <div className="mt-5">
          <Card title="Uso de cupones" padded={false}>
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th>Cupón</Th>
                  <Th align="center">Pedidos</Th>
                  <Th align="right">Descuento otorgado</Th>
                  <Th align="right">Ventas generadas</Th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <Tr key={coupon.code}>
                    <Td className="font-mono accent-text">{coupon.code}</Td>
                    <Td align="center">{coupon.orders}</Td>
                    <Td align="right" className="text-signal-warn">−{formatCLP(coupon.discount)}</Td>
                    <Td align="right" className="font-medium text-chalk">{formatCLP(coupon.revenue)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}
    </>
  );
}
