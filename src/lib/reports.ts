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

export interface SizeDemandRow {
  size: string;
  /** Unidades que entraron al carrito en el período. */
  added: number;
  /** Unidades vendidas con pago aprobado. */
  sold: number;
  /** Agregadas que no terminaron en compra. */
  abandoned: number;
  /** Clics en "¿Te interesa esta talla?". */
  interest: number;
  /** Stock disponible hoy, sumando todos los productos. */
  stock: number;
}

export interface VariantDemandRow extends Omit<SizeDemandRow, 'size'> {
  variantId: string;
  productName: string;
  colorName: string;
  size: string;
  sku: string;
  active: boolean;
  /** Unidades sugeridas para pedir a fábrica. */
  suggested: number;
}

function orden(a: string, b: string) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

/**
 * Demanda por talla y por variante: lo que se agrega al carrito, lo que se
 * compra, lo que se abandona y el interés por tallas agotadas.
 */
export async function sizeDemand(from: Date, to: Date) {
  const range = { gte: from, lte: to };
  const [adds, sales, interests] = await Promise.all([
    prisma.cartEvent.groupBy({ by: ['variantId'], where: { createdAt: range }, _sum: { quantity: true } }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { variantId: { not: null }, order: { ...PAID, createdAt: range } },
      _sum: { quantity: true },
    }),
    prisma.sizeInterest.groupBy({ by: ['variantId'], where: { createdAt: range }, _count: true }),
  ]);

  const addMap = new Map(adds.map((r) => [r.variantId, r._sum.quantity ?? 0]));
  const soldMap = new Map(sales.map((r) => [r.variantId as string, r._sum.quantity ?? 0]));
  const intMap = new Map(interests.map((r) => [r.variantId, r._count]));

  const ids = new Set([...addMap.keys(), ...soldMap.keys(), ...intMap.keys()]);
  const variants = await prisma.variant.findMany({
    where: { OR: [{ id: { in: [...ids] } }, { product: { status: 'ACTIVE' } }] },
    select: {
      id: true, size: true, sku: true, stock: true, reserved: true, active: true,
      product: { select: { name: true } },
      color: { select: { name: true } },
    },
  });

  const rows: VariantDemandRow[] = variants.map((v) => {
    const added = addMap.get(v.id) ?? 0;
    const sold = soldMap.get(v.id) ?? 0;
    const interest = intMap.get(v.id) ?? 0;
    const stock = v.active ? Math.max(0, v.stock - v.reserved) : 0;
    // Lo vendido más la demanda que no se pudo atender, menos lo que hay.
    const demand = sold + interest + Math.max(0, added - sold);
    return {
      variantId: v.id,
      productName: v.product.name,
      colorName: v.color.name,
      size: v.size,
      sku: v.sku,
      active: v.active,
      added,
      sold,
      abandoned: Math.max(0, added - sold),
      interest,
      stock,
      suggested: Math.max(0, demand - stock),
    };
  });

  const bySize = new Map<string, SizeDemandRow>();
  for (const r of rows) {
    const acc = bySize.get(r.size) ?? { size: r.size, added: 0, sold: 0, abandoned: 0, interest: 0, stock: 0 };
    acc.added += r.added;
    acc.sold += r.sold;
    acc.abandoned += r.abandoned;
    acc.interest += r.interest;
    acc.stock += r.stock;
    bySize.set(r.size, acc);
  }

  return {
    sizes: [...bySize.values()].sort((a, b) => orden(a.size, b.size)),
    variants: rows
      .filter((r) => r.added + r.sold + r.interest > 0)
      .sort((a, b) => b.suggested - a.suggested || b.interest - a.interest || b.abandoned - a.abandoned),
  };
}

/** Últimos pedidos de aviso con correo, para contactar cuando llegue la reposición. */
export async function recentSizeInterests(from: Date, to: Date, limit = 50) {
  return prisma.sizeInterest.findMany({
    where: { createdAt: { gte: from, lte: to }, email: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, email: true, createdAt: true,
      variant: { select: { size: true, sku: true, stock: true, reserved: true, product: { select: { name: true } }, color: { select: { name: true } } } },
    },
  });
}
