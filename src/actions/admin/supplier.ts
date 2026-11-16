'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { syncFactoryStock } from '@/lib/supplier';

/**
 * Guarda el enlace de cada producto y color con la tienda del proveedor y
 * consulta el stock de fábrica con el enlace nuevo.
 *
 * Los campos llegan como `handle:<productId>` y `color:<colorId>`; vacío
 * significa "sin enlazar".
 */
export async function saveSupplierLinks(formData: FormData): Promise<void> {
  await requireAdmin();

  const handles: [string, string | null][] = [];
  const colors: [string, string | null][] = [];
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().slice(0, 200) || null;
    if (key.startsWith('handle:')) handles.push([key.slice(7), value]);
    else if (key.startsWith('color:')) colors.push([key.slice(6), value]);
  }

  await prisma.$transaction([
    ...handles.map(([id, supplierHandle]) => prisma.product.updateMany({ where: { id }, data: { supplierHandle } })),
    ...colors.map(([id, supplierColor]) => prisma.productColor.updateMany({ where: { id }, data: { supplierColor } })),
  ]);

  await syncFactoryStock();
  revalidatePath('/admin/fabrica');
  revalidatePath('/', 'layout');
}

export async function syncSupplierNow(): Promise<void> {
  await requireAdmin();
  await syncFactoryStock();
  revalidatePath('/admin/fabrica');
  revalidatePath('/', 'layout');
}
