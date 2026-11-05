'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCart } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentFx } from '@/lib/fx-server';
import { evaluateIntlCart } from '@/lib/intl-cart';
import type { IntlCartPricing } from '@/lib/intl-checkout';

export interface IntlCouponState {
  ok: boolean;
  message: string;
  pricing?: IntlCartPricing;
}

export async function applyIntlCoupon(code: string, email?: string): Promise<IntlCouponState> {
  const parsed = z
    .string()
    .trim()
    .max(100)
    .transform((s) => s.toUpperCase())
    .safeParse(code);
  if (!parsed.success) return { ok: false, message: 'Revisa el código del cupón.' };
  const [cart, fx, session] = await Promise.all([getCart(), getCurrentFx(), getSession()]);
  if (!cart.id || !cart.lines.length) return { ok: false, message: 'Tu carrito está vacío.' };
  if (!fx) return { ok: false, message: 'Los precios no están disponibles en este momento.' };
  const buyerEmail = z.string().trim().email().safeParse(email);
  const { pricing } = await evaluateIntlCart(
    { ...cart, requestedCouponCode: parsed.data || null },
    fx,
    buyerEmail.success ? buyerEmail.data : session?.email,
  );
  if (pricing.couponError) return { ok: false, message: pricing.couponError };
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: pricing.couponCode } });
  for (const path of ['/carrito', '/checkout', '/intl/carrito', '/intl/checkout'])
    revalidatePath(path);
  return {
    ok: true,
    message: parsed.data ? `Cupón ${parsed.data} aplicado.` : 'Cupón quitado.',
    pricing,
  };
}
