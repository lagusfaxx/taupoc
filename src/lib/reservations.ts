import 'server-only';
import type { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from './db';
import type { SiteSettings } from './settings';

type Tx = Prisma.TransactionClient;

/*
 * Reserva de stock mientras el cliente paga.
 *
 * El carrito no aparta nada: gana la talla quien llega primero a pagar. Al
 * crear el pedido se suman sus unidades a `Variant.reserved`, con una
 * condición que solo se cumple si alcanza lo disponible (stock - reserved).
 * La comparación y el incremento van en la misma sentencia, así que dos
 * compras simultáneas de la última unidad no pueden pasar las dos: Postgres
 * bloquea la fila y la segunda vuelve a evaluar la condición con el valor
 * nuevo.
 *
 * Al confirmarse el pago la reserva se convierte en venta (commit en
 * inventory.ts y order-ops.ts). Si vence el plazo sin pago, las unidades
 * vuelven a estar disponibles y el pedido sigue pendiente, como antes.
 */

export class OutOfStockError extends Error {
  constructor(
    readonly sku: string,
    readonly productName: string,
    readonly colorName: string,
    readonly size: string,
  ) {
    super(`Sin stock para reservar ${sku}`);
    this.name = 'OutOfStockError';
  }

  /** El texto que ve el cliente. */
  get customerMessage(): string {
    return (
      `La talla ${this.size} de ${this.productName} en ${this.colorName} se agotó mientras comprabas. ` +
      'Ajusta el carrito para continuar.'
    );
  }
}

/** Hasta cuándo se aparta el stock según el medio de pago. */
export function reservationDeadline(
  method: PaymentMethod,
  settings: Pick<SiteSettings, 'reservationMinutes' | 'transferReservationHours'>,
  now = new Date(),
): Date {
  const ms =
    method === 'TRANSFER'
      ? settings.transferReservationHours * 60 * 60 * 1000
      : settings.reservationMinutes * 60 * 1000;
  return new Date(now.getTime() + ms);
}

/** Unidades del pedido agrupadas por variante y en orden fijo, para no cruzar bloqueos. */
async function orderUnits(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true, sku: true, productName: true, colorName: true, size: true },
  });
  const byVariant = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    if (!item.variantId) continue;
    const seen = byVariant.get(item.variantId);
    byVariant.set(item.variantId, seen ? { ...seen, quantity: seen.quantity + item.quantity } : item);
  }
  return [...byVariant.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([variantId, item]) => ({ ...item, variantId }));
}

/**
 * Aparta las unidades del pedido. Si alguna no alcanza lanza OutOfStockError
 * y, como corre dentro de la transacción del llamador, no queda nada apartado.
 */
export async function reserveOrderStock(tx: Tx, orderId: string, until: Date): Promise<void> {
  for (const unit of await orderUnits(tx, orderId)) {
    const updated = await tx.$executeRaw`
      UPDATE "Variant"
      SET reserved = reserved + ${unit.quantity}
      WHERE id = ${unit.variantId}
        AND active
        AND stock - reserved >= ${unit.quantity}
    `;
    if (updated === 0) throw new OutOfStockError(unit.sku, unit.productName, unit.colorName, unit.size);
  }
  await tx.order.update({ where: { id: orderId }, data: { stockReserved: true, reservedUntil: until } });
}

/**
 * Suelta la reserva del pedido, si tiene. Devuelve si había algo apartado.
 * La marca del pedido se baja con una condición, así que dos llamadas
 * simultáneas (el vencimiento y la confirmación del pago) no la liberan dos veces.
 */
export async function releaseOrderReservation(tx: Tx, orderId: string): Promise<boolean> {
  const changed = await tx.order.updateMany({
    where: { id: orderId, stockReserved: true },
    data: { stockReserved: false, reservedUntil: null },
  });
  if (changed.count === 0) return false;
  for (const unit of await orderUnits(tx, orderId)) {
    await tx.$executeRaw`
      UPDATE "Variant"
      SET reserved = GREATEST(reserved - ${unit.quantity}, 0)
      WHERE id = ${unit.variantId}
    `;
  }
  return true;
}

/** Variantes del pedido que quedaron con menos stock que lo apartado: se vendió de más. */
export async function oversoldUnits(tx: Tx, orderId: string) {
  const units = await orderUnits(tx, orderId);
  if (units.length === 0) return [];
  const variants = await tx.variant.findMany({
    where: { id: { in: units.map((u) => u.variantId) } },
    select: { id: true, sku: true, stock: true, reserved: true },
  });
  return variants.filter((v) => v.stock - v.reserved < 0);
}

/**
 * Libera las reservas vencidas de pedidos que no se pagaron.
 *
 * Un pago que el medio de pago todavía revisa (IN_PROCESS) mantiene su
 * reserva hasta que se resuelva. El pedido no cambia de estado: queda
 * pendiente, igual que un checkout abandonado antes de que existiera la
 * reserva. Si el pago llega después, se descuenta el stock como siempre.
 */
export async function releaseExpiredReservations(now = new Date()): Promise<number> {
  const expired = await prisma.order.findMany({
    where: {
      stockReserved: true,
      reservedUntil: { lt: now },
      paymentStatus: { in: ['PENDING', 'REJECTED'] },
    },
    select: { id: true },
    orderBy: { reservedUntil: 'asc' },
    take: 100,
  });
  let released = 0;
  for (const { id } of expired) {
    const done = await prisma.$transaction(async (tx) => {
      // El mismo bloqueo que toma el cambio de estado: un pago que se confirma
      // en este instante espera, o encuentra la reserva ya liberada.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id },
        select: { stockReserved: true, reservedUntil: true, paymentStatus: true },
      });
      if (
        !order?.stockReserved ||
        !order.reservedUntil ||
        order.reservedUntil >= now ||
        !['PENDING', 'REJECTED'].includes(order.paymentStatus)
      )
        return false;
      if (!(await releaseOrderReservation(tx, id))) return false;
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: 'reservation_expired',
          message: 'Venció la reserva de stock sin pago: las tallas vuelven a estar disponibles.',
          actor: 'Sistema',
        },
      });
      return true;
    });
    if (done) released++;
  }
  return released;
}

let lastSweep = 0;
let running: Promise<void> | null = null;

/**
 * Barrido perezoso para las páginas y acciones de la tienda: como mucho una
 * vez cada 30 segundos por proceso, y sin romper la página si falla. Si ya
 * hay uno en curso se espera ese, para no leer stock antes de que termine
 * (Next resuelve los metadatos y la página de la ficha en paralelo).
 */
export async function sweepExpiredReservations(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastSweep < 30_000) return;
  lastSweep = Date.now();
  running = releaseExpiredReservations()
    .then(() => undefined)
    .catch((error) => console.error('[reservas:barrido]', error))
    .finally(() => {
      running = null;
    });
  return running;
}
