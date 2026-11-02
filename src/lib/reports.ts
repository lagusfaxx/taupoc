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
  /**
   * Interés ponderado en "¿Te interesa esta talla?". Vale 1 quien dejó correo
   * o tiene cuenta, 0,5 un clic anónimo, y se reparte si la misma persona
   * marcó muchas tallas del mismo modelo.
   */
  interest: number;
  /** Personas distintas que pidieron la talla. */
  interestPeople: number;
  /** De ellas, las que dejaron correo o tienen cuenta. */
  interestConfirmed: number;
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

/** Un clic anónimo vale la mitad que alguien que dejó correo o tiene cuenta. */
const PESO_ANONIMO = 0.5;
/** Tallas de un mismo modelo que una persona real suele pedir (hermanos, duda de talla). */
const TALLAS_NORMALES = 3;
/** Unidades por carrito que cuentan como intención: agregar 10 no es 10 clientes. */
const MAX_POR_CARRITO = 2;

const redondear = (n: number) => Math.round(n * 10) / 10;

interface InteresFila {
  variantId: string;
  visitorKey: string;
  fingerprint: string | null;
  email: string | null;
  userId: string | null;
  variant: { productId: string };
}

/**
 * Peso de cada pedido de interés. Una persona se reconoce por su cuenta,
 * su correo o su huella; si marcó más tallas de un modelo de las que alguien
 * pediría de verdad, su voto se reparte entre todas y no infla ninguna.
 */
function pesarInteres(filas: InteresFila[]) {
  const persona = (f: InteresFila) =>
    f.userId ? `u:${f.userId}` : f.email ? `e:${f.email}` : f.fingerprint ? `f:${f.fingerprint}` : f.visitorKey;

  const tallasPorPersona = new Map<string, Set<string>>();
  for (const f of filas) {
    const clave = `${persona(f)}|${f.variant.productId}`;
    const set = tallasPorPersona.get(clave) ?? new Set<string>();
    set.add(f.variantId);
    tallasPorPersona.set(clave, set);
  }

  const porVariante = new Map<string, { weight: number; people: Set<string>; confirmed: number }>();
  for (const f of filas) {
    const quien = persona(f);
    const n = tallasPorPersona.get(`${quien}|${f.variant.productId}`)?.size ?? 1;
    const confirmado = Boolean(f.userId || f.email);
    const peso = (confirmado ? 1 : PESO_ANONIMO) * Math.min(1, TALLAS_NORMALES / n);
    const acc = porVariante.get(f.variantId) ?? { weight: 0, people: new Set<string>(), confirmed: 0 };
    if (!acc.people.has(quien)) {
      acc.people.add(quien);
      acc.weight += peso;
      if (confirmado) acc.confirmed += 1;
    }
    porVariante.set(f.variantId, acc);
  }
  return { porVariante, tallasPorPersona, persona };
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
    prisma.cartEvent.groupBy({ by: ['variantId', 'cartId'], where: { createdAt: range }, _sum: { quantity: true } }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { variantId: { not: null }, order: { ...PAID, createdAt: range } },
      _sum: { quantity: true },
    }),
    prisma.sizeInterest.findMany({
      where: { createdAt: range, discarded: false },
      select: { variantId: true, visitorKey: true, fingerprint: true, email: true, userId: true, variant: { select: { productId: true } } },
    }),
  ]);

  const addMap = new Map<string, number>();
  for (const r of adds) {
    addMap.set(r.variantId, (addMap.get(r.variantId) ?? 0) + Math.min(r._sum.quantity ?? 0, MAX_POR_CARRITO));
  }
  const soldMap = new Map(sales.map((r) => [r.variantId as string, r._sum.quantity ?? 0]));
  const intMap = pesarInteres(interests).porVariante;

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
    const pedido = intMap.get(v.id);
    const interest = redondear(pedido?.weight ?? 0);
    const stock = v.active ? Math.max(0, v.stock - v.reserved) : 0;
    // Lo vendido más la demanda que no se pudo atender, menos lo que hay.
    const demand = sold + Math.round(interest) + Math.max(0, added - sold);
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
      interestPeople: pedido?.people.size ?? 0,
      interestConfirmed: pedido?.confirmed ?? 0,
      stock,
      suggested: Math.max(0, demand - stock),
    };
  });

  const bySize = new Map<string, SizeDemandRow>();
  for (const r of rows) {
    const acc = bySize.get(r.size) ?? {
      size: r.size, added: 0, sold: 0, abandoned: 0, interest: 0, interestPeople: 0, interestConfirmed: 0, stock: 0,
    };
    acc.added += r.added;
    acc.sold += r.sold;
    acc.abandoned += r.abandoned;
    acc.interest = redondear(acc.interest + r.interest);
    acc.interestPeople += r.interestPeople;
    acc.interestConfirmed += r.interestConfirmed;
    acc.stock += r.stock;
    bySize.set(r.size, acc);
  }

  return {
    sizes: [...bySize.values()].sort((a, b) => orden(a.size, b.size)),
    variants: rows
      .filter((r) => r.added + r.sold + r.interestPeople > 0)
      .sort((a, b) => b.suggested - a.suggested || b.interest - a.interest || b.abandoned - a.abandoned),
  };
}

/**
 * Pedidos de interés del período, para revisarlos y descartar los falsos.
 * Cada fila trae cuántas tallas de ese modelo marcó la misma persona.
 */
export async function recentSizeInterests(from: Date, to: Date, limit = 100) {
  const filas = await prisma.sizeInterest.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, userId: true, visitorKey: true, fingerprint: true, discarded: true, createdAt: true,
      variantId: true,
      variant: {
        select: {
          productId: true, size: true, sku: true, stock: true, reserved: true,
          product: { select: { name: true } }, color: { select: { name: true } },
        },
      },
    },
  });
  const activas = filas.filter((f) => !f.discarded);
  const { tallasPorPersona, persona } = pesarInteres(activas);
  return filas.slice(0, limit).map((f) => ({
    ...f,
    sizesMarked: tallasPorPersona.get(`${persona(f)}|${f.variant.productId}`)?.size ?? 1,
    confirmed: Boolean(f.userId || f.email),
  }));
}
