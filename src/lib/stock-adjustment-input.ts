import { z } from 'zod';

export const MAX_STOCK_CHANGE = 1_000_000;
const stockInteger = z.number().int().min(-2_147_483_648).max(2_147_483_647);

export const stockAdjustmentSchema = z
  .object({
    operationId: z.string().uuid(),
    productId: z.string().min(1).max(100),
    mode: z.enum(['add', 'remove', 'count']),
    note: z.string().trim().max(300).default(''),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1).max(100),
          quantity: z.number().int().min(0).max(MAX_STOCK_CHANGE),
          expectedStock: stockInteger,
          expectedReserved: z.number().int().min(0).max(2_147_483_647),
        }),
      )
      .min(1)
      .max(500),
  })
  .superRefine((input, ctx) => {
    if (new Set(input.items.map((i) => i.variantId)).size !== input.items.length) {
      ctx.addIssue({ code: 'custom', message: 'Hay tallas repetidas.' });
    }
    for (const item of input.items) {
      if (input.mode === 'count' ? item.quantity === item.expectedStock : item.quantity === 0) {
        ctx.addIssue({ code: 'custom', message: 'Ingresa las cantidades que quieres cambiar.' });
      }
    }
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockMode = StockAdjustmentInput['mode'];

export function stockDelta(mode: StockMode, quantity: number, current: number) {
  return mode === 'count' ? quantity - current : mode === 'remove' ? -quantity : quantity;
}

export const STOCK_MODE_LABEL: Record<StockMode, string> = {
  add: 'Agregar stock',
  remove: 'Quitar stock',
  count: 'Corregir conteo',
};
