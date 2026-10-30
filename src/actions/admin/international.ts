'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateFx } from '@/lib/fx-server';
import type { AdminState } from './products';

const decimal = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(',', '.')))
    .refine((n) => Number.isFinite(n) && n >= min && n <= max, `${label}: ingresa un valor entre ${min} y ${max}.`);

const schema = z.object({
  clpPerUsd: decimal('Tipo de cambio', 100, 10000),
  marginPct: decimal('Margen', 0, 200),
  vatPct: decimal('IVA', 0, 50),
  rounding: z.enum(['CENTS_99', 'WHOLE', 'WHOLE_9', 'WHOLE_5']),
  note: z.string().trim().max(200).optional(),
});

/**
 * Guarda un tipo de cambio nuevo. No se edita el anterior: queda en el
 * historial para saber con qué valores se cobró cada pedido.
 */
export async function saveExchangeRate(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;
  await prisma.exchangeRate.create({
    data: {
      clpPerUsd: d.clpPerUsd,
      marginPct: d.marginPct,
      vatPct: d.vatPct,
      rounding: d.rounding,
      note: d.note || null,
      createdBy: admin.email,
    },
  });
  invalidateFx();
  revalidatePath('/admin/internacional');
  return { ok: true, message: 'Tipo de cambio guardado. Los precios de taupoc.lat ya usan el nuevo valor.' };
}
