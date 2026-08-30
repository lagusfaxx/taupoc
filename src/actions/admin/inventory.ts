'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { setStock } from '@/lib/inventory';
import type { AdminState } from './products';

/** Ajuste rápido de stock desde la vista de inventario. */
export async function quickAdjustStock(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const variantId = String(formData.get('variantId') ?? '');
  const stock = Math.max(0, Number(formData.get('stock') ?? 0) || 0);
  const reason = String(formData.get('reason') ?? '').trim() || 'Ajuste desde inventario';

  if (!variantId) return { ok: false, message: 'Variante no encontrada.' };

  await setStock({ variantId, stock, actorEmail: admin.email, reason });

  revalidatePath('/admin/inventario');
  revalidatePath('/catalogo');
  return { ok: true, message: 'Stock actualizado.' };
}

export async function setVariantThreshold(variantId: string, threshold: number) {
  await requireAdmin();
  await prisma.variant.update({
    where: { id: variantId },
    data: { lowStockThreshold: Math.max(0, threshold) },
  });
  revalidatePath('/admin/inventario');
}
