import 'server-only';
import { prisma } from './db';
import { adjustStock } from './inventory';
import { stockAdjustmentSchema, stockDelta, STOCK_MODE_LABEL } from './stock-adjustment-input';

export class StockAdjustmentError extends Error {}

/** Cada envío se guarda completo, con las existencias y su historial en la misma transacción. */
export async function applyStockAdjustment(raw: unknown, actorEmail: string) {
  const parsed = stockAdjustmentSchema.safeParse(raw);
  if (!parsed.success)
    throw new StockAdjustmentError(
      'Revisa las cantidades: usa números enteros y al menos una talla.',
    );
  const input = parsed.data;
  const items = [...input.items].sort((a, b) => (a.variantId < b.variantId ? -1 : 1));
  const reason = [STOCK_MODE_LABEL[input.mode], input.note].filter(Boolean).join(' · ');
  const type = input.mode === 'add' ? 'RESTOCK' : 'ADJUST';
  // La clave del movimiento conserva la idempotencia sin migrar ni reemplazar registros existentes.
  const movementId = (variantId: string) => `stock:${input.operationId}:${variantId}`;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.operationId}))`;
      const previous = await tx.inventoryMovement.findMany({
        where: { id: { startsWith: `stock:${input.operationId}:` } },
      });
      if (previous.length > 0) {
        const same =
          previous.length === items.length &&
          items.every((item) => {
            const movement = previous.find((m) => m.id === movementId(item.variantId));
            const delta = stockDelta(input.mode, item.quantity, item.expectedStock);
            return (
              movement?.delta === delta &&
              movement.resulting === item.expectedStock + delta &&
              movement.type === type &&
              movement.reason === reason &&
              movement.actorEmail === actorEmail
            );
          });
        if (!same)
          throw new StockAdjustmentError('Este cambio ya fue guardado. Abre un nuevo ajuste.');
        const stocks = await tx.variant.findMany({
          where: { id: { in: items.map((i) => i.variantId) }, productId: input.productId },
          select: { id: true, stock: true, reserved: true },
        });
        if (stocks.length !== items.length)
          throw new StockAdjustmentError('Producto no válido para este ajuste.');
        return {
          stocks,
          changed: previous.length,
          units: previous.reduce((sum, m) => sum + Math.abs(m.delta), 0),
        };
      }

      let units = 0;
      for (const item of items) {
        // El mismo bloqueo que usan ventas y reservas: no sobreescribimos cambios de otra persona.
        const [variant] = await tx.$queryRaw<
          {
            id: string;
            productId: string;
            stock: number;
            reserved: number;
            size: string;
          }[]
        >`SELECT id, "productId", stock, reserved, size FROM "Variant" WHERE id = ${item.variantId} FOR UPDATE`;
        if (!variant || variant.productId !== input.productId) {
          throw new StockAdjustmentError(
            'Una de las tallas no pertenece a este producto. Actualiza la pantalla.',
          );
        }
        if (variant.stock !== item.expectedStock || variant.reserved !== item.expectedReserved) {
          throw new StockAdjustmentError(
            `El stock de la talla ${variant.size} cambió mientras editabas. Cierra y vuelve a abrir el ajuste para revisar las cantidades actuales.`,
          );
        }
        const delta = stockDelta(input.mode, item.quantity, variant.stock);
        const resulting = variant.stock + delta;
        if (resulting > 2_147_483_647 || resulting < -2_147_483_648) {
          throw new StockAdjustmentError('La cantidad excede el límite permitido.');
        }
        // Una reposición puede resolver un faltante parcial. Un retiro no puede consumir reservas.
        if (delta < 0 && resulting < Math.max(0, variant.reserved)) {
          throw new StockAdjustmentError(
            `No puedes quitar tantas unidades de la talla ${variant.size}. Hay ${Math.max(0, variant.stock - variant.reserved)} disponibles y ${variant.reserved} reservadas.`,
          );
        }
        await adjustStock(tx, {
          variantId: variant.id,
          delta,
          type,
          reason,
          actorEmail,
          movementId: movementId(variant.id),
        });
        units += Math.abs(delta);
      }
      const stocks = await tx.variant.findMany({
        where: { id: { in: items.map((i) => i.variantId) } },
        select: { id: true, stock: true, reserved: true },
      });
      return { stocks, changed: items.length, units };
    },
    { timeout: 15_000 },
  );
}
