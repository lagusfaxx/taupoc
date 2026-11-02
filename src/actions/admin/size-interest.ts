'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** Descarta o recupera un pedido de interés. Descartado no cuenta en la demanda. */
export async function toggleSizeInterest(id: string, discarded: boolean) {
  await requireAdmin();
  await prisma.sizeInterest.update({ where: { id }, data: { discarded } });
  revalidatePath('/admin/tallas');
}

/** Descarta todo lo que pidió una persona (misma huella o visitante) en un modelo. */
export async function discardPersonInterests(id: string) {
  await requireAdmin();
  const fila = await prisma.sizeInterest.findUnique({
    where: { id },
    select: { visitorKey: true, fingerprint: true, email: true, userId: true, variant: { select: { productId: true } } },
  });
  if (!fila) return;
  await prisma.sizeInterest.updateMany({
    where: {
      variant: { productId: fila.variant.productId },
      OR: [
        { visitorKey: fila.visitorKey },
        ...(fila.fingerprint ? [{ fingerprint: fila.fingerprint }] : []),
        ...(fila.email ? [{ email: fila.email }] : []),
        ...(fila.userId ? [{ userId: fila.userId }] : []),
      ],
    },
    data: { discarded: true },
  });
  revalidatePath('/admin/tallas');
}
