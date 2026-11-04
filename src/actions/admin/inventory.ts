'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { applyStockAdjustment, StockAdjustmentError } from '@/lib/stock-management';
import type { StockAdjustmentInput } from '@/lib/stock-adjustment-input';
import type { AdminState } from './products';

export interface StockAdjustmentState extends AdminState {
  stocks?: { id: string; stock: number; reserved: number }[];
}

export async function saveStockAdjustment(
  input: StockAdjustmentInput,
): Promise<StockAdjustmentState> {
  const admin = await requireAdmin();
  let state: StockAdjustmentState;
  try {
    const result = await applyStockAdjustment(input, admin.email);
    state = {
      ok: true,
      stocks: result.stocks,
      message: `${result.units} ${result.units === 1 ? 'unidad actualizada' : 'unidades actualizadas'}. El cambio quedó guardado en el historial.`,
    };
  } catch (error) {
    state = {
      ok: false,
      message:
        error instanceof StockAdjustmentError
          ? error.message
          : 'No se pudo guardar. Reintenta el mismo ajuste; no se duplicará.',
    };
    if (!(error instanceof StockAdjustmentError)) console.error('[stock:ajuste]', error);
  }
  revalidatePath('/admin/inventario');
  revalidatePath('/admin/inventario/historial');
  revalidatePath('/admin/productos');
  revalidatePath('/admin', 'layout');
  revalidatePath('/catalogo');
  revalidatePath('/');
  revalidatePath('/producto/[slug]', 'page');
  return state;
}

export async function setVariantVisibility(
  variantId: string,
  active: boolean,
): Promise<AdminState> {
  await requireAdmin();
  if (typeof variantId !== 'string' || typeof active !== 'boolean') {
    return { ok: false, message: 'Talla no válida.' };
  }
  const variant = await prisma.variant.update({
    where: { id: variantId },
    data: { active },
    select: { productId: true, product: { select: { slug: true } } },
  });
  revalidatePath('/admin/inventario');
  revalidatePath(`/admin/productos/${variant.productId}`);
  revalidatePath('/catalogo');
  revalidatePath(`/producto/${variant.product.slug}`);
  return {
    ok: true,
    message: active
      ? 'Talla visible en la tienda.'
      : 'Talla oculta. Su stock e historial se conservan.',
  };
}

export async function setVariantThreshold(variantId: string, threshold: number) {
  await requireAdmin();
  if (!Number.isInteger(threshold) || threshold < 0) return;
  await prisma.variant.update({ where: { id: variantId }, data: { lowStockThreshold: threshold } });
  revalidatePath('/admin/inventario');
}
