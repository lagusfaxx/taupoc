'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseCLP } from '@/lib/money';
import type { AdminState } from './products';

function revalidateShipping() {
  revalidatePath('/admin/envios');
  revalidatePath('/checkout');
  revalidatePath('/envios');
}

const zoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Ingresa el nombre de la zona.'),
  regions: z.string().optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function saveZone(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = zoneSchema.safeParse({
    id: formData.get('id') ?? undefined,
    name: formData.get('name'),
    regions: formData.getAll('regions').join(','),
    sortOrder: formData.get('sortOrder') ?? undefined,
    active: formData.get('active') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;

  const data = {
    name: d.name.trim(),
    regions: (d.regions ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    sortOrder: d.sortOrder ? Number(d.sortOrder) || 0 : 0,
    active: d.active === 'on',
  };

  if (d.id) await prisma.shippingZone.update({ where: { id: d.id }, data });
  else await prisma.shippingZone.create({ data });

  revalidateShipping();
  return { ok: true, message: 'Zona guardada.' };
}

export async function deleteZone(id: string) {
  await requireAdmin();
  await prisma.shippingZone.delete({ where: { id } });
  revalidateShipping();
}

const rateSchema = z.object({
  id: z.string().optional(),
  zoneId: z.string().min(1, 'Selecciona la zona.'),
  carrier: z.string().min(1, 'Ingresa el courier.'),
  label: z.string().min(2, 'Ingresa el nombre del servicio.'),
  description: z.string().optional(),
  mode: z.enum(['FLAT', 'BY_WEIGHT', 'BY_SUBTOTAL']),
  price: z.string().optional(),
  minWeightG: z.string().optional(),
  maxWeightG: z.string().optional(),
  minSubtotal: z.string().optional(),
  maxSubtotal: z.string().optional(),
  freeOverSubtotal: z.string().optional(),
  etaMinDays: z.string().optional(),
  etaMaxDays: z.string().optional(),
  isPickup: z.string().optional(),
  pickupInfo: z.string().optional(),
  active: z.string().optional(),
  sortOrder: z.string().optional(),
});

const numOrNull = (v?: string) => {
  const trimmed = (v ?? '').trim();
  if (!trimmed) return null;
  const n = parseCLP(trimmed);
  return Number.isFinite(n) ? n : null;
};

export async function saveRate(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;

  const data = {
    zoneId: d.zoneId,
    carrier: d.carrier.trim(),
    label: d.label.trim(),
    description: d.description?.trim() || null,
    mode: d.mode,
    price: parseCLP(d.price ?? '0'),
    minWeightG: numOrNull(d.minWeightG),
    maxWeightG: numOrNull(d.maxWeightG),
    minSubtotal: numOrNull(d.minSubtotal),
    maxSubtotal: numOrNull(d.maxSubtotal),
    freeOverSubtotal: numOrNull(d.freeOverSubtotal),
    etaMinDays: Number(d.etaMinDays ?? 2) || 1,
    etaMaxDays: Number(d.etaMaxDays ?? 5) || 5,
    isPickup: d.isPickup === 'on',
    pickupInfo: d.pickupInfo?.trim() || null,
    active: d.active === 'on',
    sortOrder: Number(d.sortOrder ?? 0) || 0,
  };

  if (data.etaMaxDays < data.etaMinDays) {
    return { ok: false, message: 'El plazo máximo no puede ser menor que el mínimo.' };
  }

  if (d.id) await prisma.shippingRate.update({ where: { id: d.id }, data });
  else await prisma.shippingRate.create({ data });

  revalidateShipping();
  return { ok: true, message: 'Tarifa guardada.' };
}

export async function deleteRate(id: string) {
  await requireAdmin();
  await prisma.shippingRate.delete({ where: { id } });
  revalidateShipping();
}

export async function toggleRate(id: string, active: boolean) {
  await requireAdmin();
  await prisma.shippingRate.update({ where: { id }, data: { active } });
  revalidateShipping();
}
