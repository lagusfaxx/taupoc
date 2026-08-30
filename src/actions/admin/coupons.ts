'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseCLP } from '@/lib/money';
import type { AdminState } from './products';

const schema = z.object({
  id: z.string().optional(),
  code: z.string().min(3, 'El código debe tener al menos 3 caracteres.'),
  description: z.string().optional(),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  value: z.string().optional(),
  minSubtotal: z.string().optional(),
  maxUses: z.string().optional(),
  perUserLimit: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  active: z.string().optional(),
});

const dateOrNull = (v?: string) => {
  const trimmed = (v ?? '').trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

const intOrNull = (v?: string) => {
  const trimmed = (v ?? '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export async function saveCoupon(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;
  const code = d.code.trim().toUpperCase().replace(/\s+/g, '');

  // El valor se interpreta según el tipo: porcentaje o monto en pesos.
  const value =
    d.type === 'PERCENT'
      ? Math.min(100, Math.max(0, Number(d.value ?? 0) || 0))
      : d.type === 'FIXED'
        ? parseCLP(d.value ?? '0')
        : 0;

  if (d.type === 'PERCENT' && (value < 1 || value > 100)) {
    return { ok: false, message: 'El porcentaje debe estar entre 1 y 100.' };
  }
  if (d.type === 'FIXED' && value < 1) {
    return { ok: false, message: 'El monto del descuento debe ser mayor a cero.' };
  }

  const startsAt = dateOrNull(d.startsAt);
  const endsAt = dateOrNull(d.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    return { ok: false, message: 'La fecha de término no puede ser anterior a la de inicio.' };
  }

  const data = {
    code,
    description: d.description?.trim() || null,
    type: d.type,
    value,
    minSubtotal: d.minSubtotal ? parseCLP(d.minSubtotal) || null : null,
    maxUses: intOrNull(d.maxUses),
    perUserLimit: intOrNull(d.perUserLimit),
    startsAt,
    endsAt,
    active: d.active === 'on',
  };

  const clash = await prisma.coupon.findFirst({
    where: { code, ...(d.id ? { NOT: { id: d.id } } : {}) },
  });
  if (clash) return { ok: false, message: `Ya existe un cupón con el código ${code}.` };

  // Restricción por productos: si no se marca ninguno, aplica a todo el carrito.
  const productIds = formData.getAll('productIds').map(String).filter(Boolean);

  if (d.id) {
    await prisma.coupon.update({ where: { id: d.id }, data });
    await prisma.couponProduct.deleteMany({ where: { couponId: d.id } });
    if (productIds.length > 0) {
      await prisma.couponProduct.createMany({
        data: productIds.map((productId) => ({ couponId: d.id!, productId })),
      });
    }
  } else {
    const coupon = await prisma.coupon.create({ data });
    if (productIds.length > 0) {
      await prisma.couponProduct.createMany({
        data: productIds.map((productId) => ({ couponId: coupon.id, productId })),
      });
    }
  }

  revalidatePath('/admin/cupones');
  return { ok: true, message: `Cupón ${code} guardado.` };
}

export async function toggleCoupon(id: string, active: boolean) {
  await requireAdmin();
  await prisma.coupon.update({ where: { id }, data: { active } });
  revalidatePath('/admin/cupones');
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  const used = await prisma.order.count({ where: { couponId: id } });
  if (used > 0) {
    // Un cupón ya usado se desactiva, para conservar el historial de pedidos.
    await prisma.coupon.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.coupon.delete({ where: { id } });
  }
  revalidatePath('/admin/cupones');
}
