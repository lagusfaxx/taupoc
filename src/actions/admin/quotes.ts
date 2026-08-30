'use server';

import { revalidatePath } from 'next/cache';
import type { QuoteStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminState } from './products';

export async function updateQuote(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as QuoteStatus;
  const adminNote = String(formData.get('adminNote') ?? '').trim();

  if (!id) return { ok: false, message: 'Cotización no encontrada.' };

  await prisma.quoteRequest.update({
    where: { id },
    data: { status, adminNote: adminNote || null },
  });

  revalidatePath('/admin/cotizaciones');
  return { ok: true, message: 'Cotización actualizada.' };
}

export async function deleteQuote(id: string) {
  await requireAdmin();
  await prisma.quoteRequest.delete({ where: { id } });
  revalidatePath('/admin/cotizaciones');
}
