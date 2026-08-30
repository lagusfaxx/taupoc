import 'server-only';
import type { MovementType, Prisma } from '@prisma/client';
import { prisma } from './db';
import { getSettings } from './settings';
import { sendLowStockAlert } from './mail';

type Tx = Prisma.TransactionClient;

/**
 * Ajusta el stock de una variante y deja registro del movimiento.
 * Siempre pasa por acá: el historial de inventario es lo que permite
 * auditar diferencias entre lo vendido en stand y lo vendido online.
 */
export async function adjustStock(
  db: Tx | typeof prisma,
  params: {
    variantId: string;
    delta: number;
    type: MovementType;
    reason?: string;
    actorEmail?: string;
    orderId?: string;
  },
) {
  const variant = await db.variant.update({
    where: { id: params.variantId },
    data: { stock: { increment: params.delta } },
  });
  await db.inventoryMovement.create({
    data: {
      variantId: params.variantId,
      type: params.type,
      delta: params.delta,
      resulting: variant.stock,
      reason: params.reason,
      actorEmail: params.actorEmail,
      orderId: params.orderId,
    },
  });
  return variant;
}

/** Fija el stock a un valor absoluto (usado por la matriz talla × color). */
export async function setStock(params: {
  variantId: string;
  stock: number;
  actorEmail?: string;
  reason?: string;
}) {
  const current = await prisma.variant.findUnique({ where: { id: params.variantId } });
  if (!current) throw new Error('Variante no encontrada');
  const delta = params.stock - current.stock;
  if (delta === 0) return current;
  return adjustStock(prisma, {
    variantId: params.variantId,
    delta,
    type: 'ADJUST',
    reason: params.reason ?? 'Ajuste manual desde el panel',
    actorEmail: params.actorEmail,
  });
}

/** Descuenta el stock de un pedido pagado. */
export async function commitStockForOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
    for (const item of items) {
      if (!item.variantId) continue;
      await adjustStock(tx, {
        variantId: item.variantId,
        delta: -item.quantity,
        type: 'SALE',
        reason: 'Venta online',
        orderId,
      });
    }
  });
  void checkLowStock();
}

/** Devuelve el stock de un pedido cancelado o reembolsado. */
export async function restoreStockForOrder(orderId: string, type: MovementType = 'CANCEL') {
  await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
    for (const item of items) {
      if (!item.variantId) continue;
      await adjustStock(tx, {
        variantId: item.variantId,
        delta: item.quantity,
        type,
        reason: type === 'RETURN' ? 'Devolución' : 'Pedido cancelado',
        orderId,
      });
    }
  });
}

export interface LowStockRow {
  variantId: string;
  sku: string;
  productName: string;
  productSlug: string;
  colorName: string;
  size: string;
  stock: number;
  threshold: number;
}

/** Variantes activas por debajo de su umbral. */
export async function getLowStock(limit = 100): Promise<LowStockRow[]> {
  const settings = await getSettings();
  const variants = await prisma.variant.findMany({
    where: { active: true, product: { status: { in: ['ACTIVE', 'COMING_SOON'] } } },
    include: { product: { select: { name: true, slug: true } }, color: { select: { name: true } } },
    orderBy: { stock: 'asc' },
    take: 500,
  });
  return variants
    .map((v) => ({
      variantId: v.id,
      sku: v.sku,
      productName: v.product.name,
      productSlug: v.product.slug,
      colorName: v.color.name,
      size: v.size,
      stock: v.stock,
      threshold: v.lowStockThreshold || settings.lowStockThreshold,
    }))
    .filter((v) => v.stock <= v.threshold)
    .slice(0, limit);
}

/**
 * Envía la alerta de stock bajo. Se llama después de cada venta;
 * el flag en Setting evita repetir el mismo aviso más de una vez al día.
 */
export async function checkLowStock() {
  try {
    const rows = await getLowStock(50);
    if (rows.length === 0) return;

    const key = 'lowstock:last-alert';
    const last = await prisma.setting.findUnique({ where: { key } });
    const lastAt = last ? new Date(String((last.value as { at?: string })?.at ?? 0)).getTime() : 0;
    if (Date.now() - lastAt < 12 * 60 * 60 * 1000) return;

    await sendLowStockAlert(rows.map((r) => ({
      sku: r.sku,
      productName: r.productName,
      colorName: r.colorName,
      size: r.size,
      stock: r.stock,
    })));
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: { at: new Date().toISOString() } },
      update: { value: { at: new Date().toISOString() } },
    });
  } catch (error) {
    console.error('[lowstock:error]', error);
  }
}
