import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

/**
 * Indicadores para llevar la tienda: embudo de conversión, origen del tráfico,
 * rendimiento por producto, clientes, medios de pago, carritos abandonados,
 * cobertura de inventario y operación.
 *
 * Las ventas salen de los pedidos; las visitas, de la analítica propia
 * (`SiteEvent`), que empieza a contar desde que se despliega.
 */

const PAID = Prisma.sql`o."paymentStatus" = 'APPROVED'`;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** El período inmediatamente anterior, del mismo largo. */
export function previousRange(from: Date, to: Date) {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: new Date(from) };
}

/** Variación porcentual; `null` cuando no hay base contra la que comparar. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

// ─────────────────────────────────────────────────────────────
// Embudo
// ─────────────────────────────────────────────────────────────

export interface Funnel {
  visitors: number;
  sessions: number;
  productSessions: number;
  carts: number;
  checkoutSessions: number;
  orders: number;
  paidOrders: number;
  /** Primer evento registrado: antes de esa fecha no hay visitas medidas. */
  trackingSince: Date | null;
}

export async function funnel(from: Date, to: Date): Promise<Funnel> {
  const [events, carts, orders, first] = await Promise.all([
    prisma.$queryRaw<{ visitors: bigint; sessions: bigint; product: bigint; checkout: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorId") AS visitors,
             COUNT(DISTINCT "sessionId") AS sessions,
             COUNT(DISTINCT "sessionId") FILTER (WHERE "type" = 'PRODUCT_VIEW') AS product,
             COUNT(DISTINCT "sessionId") FILTER (WHERE "type" = 'CHECKOUT_START') AS checkout
      FROM "SiteEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
    prisma.$queryRaw<{ carts: bigint }[]>`
      SELECT COUNT(DISTINCT "cartId") AS carts FROM "CartEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
    // Los pedidos creados a mano en el panel no pasaron por la tienda.
    prisma.$queryRaw<{ orders: bigint; paid: bigint }[]>`
      SELECT COUNT(*) AS orders,
             COUNT(*) FILTER (WHERE o."paymentStatus" = 'APPROVED') AS paid
      FROM "Order" o
      WHERE o."creationKey" IS NULL AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    `,
    prisma.siteEvent.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);

  return {
    visitors: n(events[0]?.visitors),
    sessions: n(events[0]?.sessions),
    productSessions: n(events[0]?.product),
    carts: n(carts[0]?.carts),
    checkoutSessions: n(events[0]?.checkout),
    orders: n(orders[0]?.orders),
    paidOrders: n(orders[0]?.paid),
    trackingSince: first?.createdAt ?? null,
  };
}

/** Sesiones por día, para dibujar las visitas junto a las ventas. */
export async function dailySessions(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ day: Date; sessions: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(DISTINCT "sessionId") AS sessions
    FROM "SiteEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1 ORDER BY 1
  `;
  return rows.map((r) => ({ day: r.day, sessions: n(r.sessions) }));
}

// ─────────────────────────────────────────────────────────────
// Tráfico
// ─────────────────────────────────────────────────────────────

export interface SourceRow {
  source: string;
  sessions: number;
  productSessions: number;
  checkouts: number;
  orders: number;
}

export async function trafficSources(from: Date, to: Date): Promise<SourceRow[]> {
  const rows = await prisma.$queryRaw<
    { source: string; sessions: bigint; product: bigint; checkouts: bigint; orders: bigint }[]
  >`
    SELECT "source",
           COUNT(DISTINCT "sessionId") AS sessions,
           COUNT(DISTINCT "sessionId") FILTER (WHERE "type" = 'PRODUCT_VIEW') AS product,
           COUNT(DISTINCT "sessionId") FILTER (WHERE "type" = 'CHECKOUT_START') AS checkouts,
           COUNT(*) FILTER (WHERE "type" = 'PURCHASE') AS orders
    FROM "SiteEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 12
  `;
  return rows.map((r) => ({
    source: r.source,
    sessions: n(r.sessions),
    productSessions: n(r.product),
    checkouts: n(r.checkouts),
    orders: n(r.orders),
  }));
}

export async function devices(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ device: string; sessions: bigint; orders: bigint }[]>`
    SELECT "device",
           COUNT(DISTINCT "sessionId") AS sessions,
           COUNT(*) FILTER (WHERE "type" = 'PURCHASE') AS orders
    FROM "SiteEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1 ORDER BY 2 DESC
  `;
  return rows.map((r) => ({ device: r.device, sessions: n(r.sessions), orders: n(r.orders) }));
}

export const SOURCE_LABEL: Record<string, string> = {
  direct: 'Directo',
  google: 'Google (búsqueda)',
  'google-ads': 'Google Ads',
  'meta-ads': 'Anuncios de Meta',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  buscadores: 'Otros buscadores',
  mercadolibre: 'Mercado Libre',
  ia: 'Asistentes de IA',
};

export const DEVICE_LABEL: Record<string, string> = {
  mobile: 'Celular',
  desktop: 'Computador',
  tablet: 'Tablet',
};

// ─────────────────────────────────────────────────────────────
// Productos
// ─────────────────────────────────────────────────────────────

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  views: number;
  carts: number;
  units: number;
  revenue: number;
  stock: number;
}

/** Por producto: cuántos lo miran, cuántos lo agregan y cuántos lo compran. */
export async function productPerformance(from: Date, to: Date): Promise<ProductPerformanceRow[]> {
  const [products, views, carts, sales, stock] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
      select: { id: true, name: true },
    }),
    prisma.$queryRaw<{ productId: string; views: bigint }[]>`
      SELECT "productId", COUNT(DISTINCT "sessionId") AS views
      FROM "SiteEvent"
      WHERE "type" = 'PRODUCT_VIEW' AND "productId" IS NOT NULL
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ productId: string; carts: bigint }[]>`
      SELECT v."productId", COUNT(DISTINCT e."cartId") AS carts
      FROM "CartEvent" e JOIN "Variant" v ON v."id" = e."variantId"
      WHERE e."createdAt" >= ${from} AND e."createdAt" <= ${to}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ productId: string; units: bigint; revenue: bigint }[]>`
      SELECT i."productId", SUM(i."quantity") AS units, SUM(i."lineTotal") AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${PAID} AND i."productId" IS NOT NULL
        AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ productId: string; stock: bigint }[]>`
      SELECT "productId", SUM(GREATEST("stock" - "reserved", 0)) AS stock
      FROM "Variant" WHERE "active" = true GROUP BY 1
    `,
  ]);

  const viewMap = new Map(views.map((r) => [r.productId, n(r.views)]));
  const cartMap = new Map(carts.map((r) => [r.productId, n(r.carts)]));
  const saleMap = new Map(sales.map((r) => [r.productId, r]));
  const stockMap = new Map(stock.map((r) => [r.productId, n(r.stock)]));

  return products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      views: viewMap.get(p.id) ?? 0,
      carts: cartMap.get(p.id) ?? 0,
      units: n(saleMap.get(p.id)?.units),
      revenue: n(saleMap.get(p.id)?.revenue),
      stock: stockMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.views - a.views);
}

// ─────────────────────────────────────────────────────────────
// Clientes
// ─────────────────────────────────────────────────────────────

export async function customerMix(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<
    { buyers: bigint; repeat_buyers: bigint; revenue_new: bigint | null; revenue_repeat: bigint | null }[]
  >`
    WITH period AS (
      SELECT lower(o."email") AS email, SUM(o."total") AS total, MIN(o."createdAt") AS first_in_period
      FROM "Order" o
      WHERE ${PAID} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY 1
    ), tagged AS (
      SELECT p.*, EXISTS (
        SELECT 1 FROM "Order" o
        WHERE ${PAID} AND lower(o."email") = p.email AND o."createdAt" < p.first_in_period
      ) AS is_repeat
      FROM period p
    )
    SELECT COUNT(*) AS buyers,
           COUNT(*) FILTER (WHERE is_repeat) AS repeat_buyers,
           SUM(total) FILTER (WHERE NOT is_repeat) AS revenue_new,
           SUM(total) FILTER (WHERE is_repeat) AS revenue_repeat
    FROM tagged
  `;
  const lifetime = await prisma.$queryRaw<{ customers: bigint; repeaters: bigint }[]>`
    SELECT COUNT(*) AS customers, COUNT(*) FILTER (WHERE orders > 1) AS repeaters
    FROM (
      SELECT lower(o."email") AS email, COUNT(*) AS orders
      FROM "Order" o WHERE ${PAID} GROUP BY 1
    ) t
  `;
  const r = rows[0];
  return {
    buyers: n(r?.buyers),
    returning: n(r?.repeat_buyers),
    fresh: n(r?.buyers) - n(r?.repeat_buyers),
    revenueNew: n(r?.revenue_new),
    revenueReturning: n(r?.revenue_repeat),
    lifetimeCustomers: n(lifetime[0]?.customers),
    lifetimeRepeaters: n(lifetime[0]?.repeaters),
  };
}

export async function topCustomers(from: Date, to: Date, limit = 8) {
  const rows = await prisma.$queryRaw<
    { email: string; name: string | null; orders: bigint; total: bigint }[]
  >`
    SELECT lower(o."email") AS email,
           MAX(NULLIF(TRIM(CONCAT(o."firstName", ' ', o."lastName")), '')) AS name,
           COUNT(*) AS orders, SUM(o."total") AS total
    FROM "Order" o
    WHERE ${PAID} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    GROUP BY 1 ORDER BY 4 DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({ email: r.email, name: r.name, orders: n(r.orders), total: n(r.total) }));
}

// ─────────────────────────────────────────────────────────────
// Pago y canales
// ─────────────────────────────────────────────────────────────

export const METHOD_LABEL: Record<string, string> = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  PAYPAL: 'PayPal',
  MANUAL: 'Manual (panel)',
};

/** Por medio de pago: cuántos pedidos se crean y cuántos llegan a pagarse. */
export async function paymentMix(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<
    { method: string; created: bigint; paid: bigint; revenue: bigint | null }[]
  >`
    SELECT o."paymentMethod"::text AS method,
           COUNT(*) AS created,
           COUNT(*) FILTER (WHERE ${PAID}) AS paid,
           SUM(o."total") FILTER (WHERE ${PAID}) AS revenue
    FROM "Order" o
    WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    GROUP BY 1 ORDER BY 4 DESC NULLS LAST
  `;
  return rows.map((r) => ({
    method: r.method,
    created: n(r.created),
    paid: n(r.paid),
    revenue: n(r.revenue),
  }));
}

export async function storefrontMix(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ storefront: string; orders: bigint; revenue: bigint | null }[]>`
    SELECT o."storefront", COUNT(*) AS orders, SUM(o."total") AS revenue
    FROM "Order" o
    WHERE ${PAID} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    GROUP BY 1 ORDER BY 3 DESC NULLS LAST
  `;
  return rows.map((r) => ({ storefront: r.storefront, orders: n(r.orders), revenue: n(r.revenue) }));
}

// ─────────────────────────────────────────────────────────────
// Cuándo se compra
// ─────────────────────────────────────────────────────────────

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Pedidos pagados por día de la semana y por hora, en hora de Chile. */
export async function buyingMoments(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; orders: bigint; revenue: bigint }[]>`
    SELECT EXTRACT(ISODOW FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago'))::int AS dow,
           EXTRACT(HOUR FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago'))::int AS hour,
           COUNT(*) AS orders, SUM(o."total") AS revenue
    FROM "Order" o
    WHERE ${PAID} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    GROUP BY 1, 2
  `;
  const weekdays = WEEKDAYS.map((label) => ({ label, orders: 0, revenue: 0 }));
  // Tramos de tres horas: con pocos pedidos, hora por hora no se lee nada.
  const blocks = Array.from({ length: 8 }, (_, i) => ({
    label: `${String(i * 3).padStart(2, '0')}–${String(i * 3 + 3).padStart(2, '0')} h`,
    orders: 0,
    revenue: 0,
  }));
  for (const r of rows) {
    const d = weekdays[r.dow - 1];
    const b = blocks[Math.floor(r.hour / 3)];
    if (d) { d.orders += n(r.orders); d.revenue += n(r.revenue); }
    if (b) { b.orders += n(r.orders); b.revenue += n(r.revenue); }
  }
  return { weekdays, blocks };
}

// ─────────────────────────────────────────────────────────────
// Carritos abandonados
// ─────────────────────────────────────────────────────────────

export interface AbandonedCart {
  cartId: string;
  updatedAt: Date;
  units: number;
  value: number;
  items: string;
  customer: { id: string; name: string; email: string } | null;
}

/**
 * Carritos con productos que llevan más de dos horas sin moverse y menos de
 * treinta días. Los que tienen cuenta se pueden recuperar escribiéndoles.
 */
export async function abandonedCarts(limit = 8) {
  const now = Date.now();
  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { lt: new Date(now - 2 * 3600_000), gt: new Date(now - 30 * 86400_000) },
      items: { some: {} },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      updatedAt: true,
      userId: true,
      items: {
        select: {
          quantity: true,
          variant: {
            select: {
              size: true,
              priceOverride: true,
              product: { select: { name: true, basePrice: true } },
            },
          },
        },
      },
    },
  });

  const userIds = [...new Set(carts.map((c) => c.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows: AbandonedCart[] = carts.map((c) => ({
    cartId: c.id,
    updatedAt: c.updatedAt,
    units: c.items.reduce((s, i) => s + i.quantity, 0),
    value: c.items.reduce((s, i) => s + i.quantity * (i.variant.priceOverride ?? i.variant.product.basePrice), 0),
    items: c.items.map((i) => `${i.variant.product.name} T${i.variant.size}`).join(', '),
    customer: c.userId ? userMap.get(c.userId) ?? null : null,
  }));

  return {
    count: rows.length,
    value: rows.reduce((s, r) => s + r.value, 0),
    reachable: rows.filter((r) => r.customer).length,
    // Primero los que se pueden contactar, después los de más valor.
    list: [...rows]
      .sort((a, b) => Number(Boolean(b.customer)) - Number(Boolean(a.customer)) || b.value - a.value)
      .slice(0, limit),
  };
}

// ─────────────────────────────────────────────────────────────
// Inventario
// ─────────────────────────────────────────────────────────────

export interface CoverageRow {
  productId: string;
  name: string;
  stock: number;
  value: number;
  sold30: number;
  /** Días que dura el stock al ritmo de los últimos 30 días; `null` sin ventas. */
  daysCover: number | null;
  skus: number;
  skusOut: number;
}

export async function inventoryCoverage() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [stock, sales] = await Promise.all([
    prisma.$queryRaw<
      { productId: string; name: string; stock: bigint; value: bigint; skus: bigint; out: bigint }[]
    >`
      SELECT p."id" AS "productId", p."name",
             SUM(GREATEST(v."stock" - v."reserved", 0)) AS stock,
             SUM(GREATEST(v."stock" - v."reserved", 0) * COALESCE(v."priceOverride", p."basePrice")) AS value,
             COUNT(*) AS skus,
             COUNT(*) FILTER (WHERE v."stock" - v."reserved" <= 0) AS out
      FROM "Variant" v
      JOIN "Product" p ON p."id" = v."productId"
      JOIN "ProductColor" c ON c."id" = v."colorId"
      WHERE v."active" = true AND c."active" = true AND p."status" = 'ACTIVE'
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<{ productId: string; units: bigint }[]>`
      SELECT i."productId", SUM(i."quantity") AS units
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${PAID} AND i."productId" IS NOT NULL AND o."createdAt" >= ${since}
      GROUP BY 1
    `,
  ]);
  const soldMap = new Map(sales.map((r) => [r.productId, n(r.units)]));

  const rows: CoverageRow[] = stock
    .map((r) => {
      const sold30 = soldMap.get(r.productId) ?? 0;
      const units = n(r.stock);
      return {
        productId: r.productId,
        name: r.name,
        stock: units,
        value: n(r.value),
        sold30,
        daysCover: sold30 > 0 ? Math.round((units / sold30) * 30) : null,
        skus: n(r.skus),
        skusOut: n(r.out),
      };
    })
    .sort((a, b) => (a.daysCover ?? 9999) - (b.daysCover ?? 9999));

  const skus = rows.reduce((s, r) => s + r.skus, 0);
  const skusOut = rows.reduce((s, r) => s + r.skusOut, 0);
  return {
    rows,
    units: rows.reduce((s, r) => s + r.stock, 0),
    value: rows.reduce((s, r) => s + r.value, 0),
    skus,
    skusOut,
  };
}

// ─────────────────────────────────────────────────────────────
// Operación
// ─────────────────────────────────────────────────────────────

/** Lo que hay que atender ahora, sin importar el período. */
export async function operations() {
  const twoDaysAgo = new Date(Date.now() - 48 * 3600_000);
  const [toPrepare, late, transfers, quotes, returnsOpen] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    prisma.order.count({
      where: { status: { in: ['PAID', 'PROCESSING'] }, OR: [{ paidAt: { lt: twoDaysAgo } }, { paidAt: null, createdAt: { lt: twoDaysAgo } }] },
    }),
    prisma.order.aggregate({
      where: { paymentMethod: 'TRANSFER', status: 'PENDING', paymentStatus: 'PENDING' },
      _count: true,
      _sum: { total: true },
    }),
    prisma.quoteRequest.count({ where: { status: 'NEW' } }),
    prisma.orderReturn.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
  ]);
  return {
    toPrepare,
    late,
    transfers: transfers._count,
    transfersAmount: transfers._sum.total ?? 0,
    quotes,
    returnsOpen,
  };
}

/** Tiempos y calidad de la operación en el período. */
export async function fulfillment(from: Date, to: Date) {
  const [ship, returns, paidOrders] = await Promise.all([
    prisma.$queryRaw<{ hours: number | null; shipped: bigint }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (o."shippedAt" - COALESCE(o."paidAt", o."createdAt"))) / 3600)::float AS hours,
             COUNT(*) AS shipped
      FROM "Order" o
      WHERE o."shippedAt" IS NOT NULL AND o."shippedAt" >= ${from} AND o."shippedAt" <= ${to}
    `,
    prisma.orderReturn.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.count({ where: { paymentStatus: 'APPROVED', createdAt: { gte: from, lte: to } } }),
  ]);
  return {
    shipHours: ship[0]?.hours != null ? Math.round(ship[0].hours) : null,
    shipped: n(ship[0]?.shipped),
    returns,
    returnRate: pct(returns, paidOrders),
  };
}

// ─────────────────────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────────────────────

const dayFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

/** Una entrada por día del rango, con ceros donde no hubo movimiento. */
export function fillDays<T extends { day: Date }>(
  from: Date,
  to: Date,
  rows: T[],
): { iso: string; label: string; row: T | undefined }[] {
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  const out: { iso: string; label: string; row: T | undefined }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ iso, label: dayFmt.format(d), row: byDay.get(iso) });
  }
  return out;
}
