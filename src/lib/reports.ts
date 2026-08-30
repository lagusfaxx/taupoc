import 'server-only';
import { prisma } from './db';

/** Rango de fechas [desde, hasta) en hora local de Chile. */
export function rangeFor(period: 'hoy' | 'semana' | 'mes' | 'anio' | '30d' | '90d') {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (period) {
    case 'hoy':
      break;
    case 'semana': {
      // Semana que comienza el lunes.
      const day = (from.getDay() + 6) % 7;
      from.setDate(from.getDate() - day);
      break;
    }
    case 'mes':
      from.setDate(1);
      break;
    case 'anio':
      from.setMonth(0, 1);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      break;
    case '90d':
      from.setDate(from.getDate() - 89);
      break;
  }
  return { from, to: now };
}

const PAID = { paymentStatus: 'APPROVED' as const };

export async function salesSummary(from: Date, to: Date) {
  const [agg, orders] = await Promise.all([
    prisma.order.aggregate({
      where: { ...PAID, createdAt: { gte: from, lte: to } },
      _sum: { total: true, subtotal: true, shippingTotal: true, discountTotal: true },
      _count: true,
    }),
    prisma.orderItem.aggregate({
      where: { order: { ...PAID, createdAt: { gte: from, lte: to } } },
      _sum: { quantity: true },
    }),
  ]);

  const count = agg._count;
  return {
    revenue: agg._sum.total ?? 0,
    subtotal: agg._sum.subtotal ?? 0,
    shipping: agg._sum.shippingTotal ?? 0,
    discounts: agg._sum.discountTotal ?? 0,
    orders: count,
    units: orders._sum.quantity ?? 0,
    average: count > 0 ? Math.round((agg._sum.total ?? 0) / count) : 0,
  };
}

/** Ventas diarias para el gráfico del dashboard. */
export async function dailySales(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint; orders: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           SUM("total")::bigint AS total,
           COUNT(*)::bigint AS orders
    FROM "Order"
    WHERE "paymentStatus" = 'APPROVED'
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    day: r.day,
    total: Number(r.total),
    orders: Number(r.orders),
  }));
}

export async function topProducts(from: Date, to: Date, limit = 10) {
  const rows = await prisma.orderItem.groupBy({
    by: ['productName'],
    where: { order: { ...PAID, createdAt: { gte: from, lte: to } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });
  return rows.map((r) => ({
    name: r.productName,
    units: r._sum.quantity ?? 0,
    revenue: r._sum.lineTotal ?? 0,
  }));
}

export async function topSizes(from: Date, to: Date) {
  const rows = await prisma.orderItem.groupBy({
    by: ['size'],
    where: { order: { ...PAID, createdAt: { gte: from, lte: to } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
  });
  return rows.map((r) => ({ size: r.size, units: r._sum.quantity ?? 0 }));
}

export async function topColors(from: Date, to: Date, limit = 12) {
  const rows = await prisma.orderItem.groupBy({
    by: ['colorName'],
    where: { order: { ...PAID, createdAt: { gte: from, lte: to } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });
  return rows.map((r) => ({ color: r.colorName, units: r._sum.quantity ?? 0 }));
}

export async function salesByRegion(from: Date, to: Date) {
  const rows = await prisma.order.groupBy({
    by: ['region'],
    where: { ...PAID, createdAt: { gte: from, lte: to } },
    _sum: { total: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
  });
  return rows.map((r) => ({
    region: r.region,
    revenue: r._sum.total ?? 0,
    orders: r._count,
  }));
}

export async function couponUsage(from: Date, to: Date) {
  const rows = await prisma.order.groupBy({
    by: ['couponCode'],
    where: { ...PAID, createdAt: { gte: from, lte: to }, couponCode: { not: null } },
    _sum: { discountTotal: true, total: true },
    _count: true,
    orderBy: { _count: { couponCode: 'desc' } },
  });
  return rows.map((r) => ({
    code: r.couponCode ?? '—',
    orders: r._count,
    discount: r._sum.discountTotal ?? 0,
    revenue: r._sum.total ?? 0,
  }));
}
