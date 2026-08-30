'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getOrCreateCart, readCartToken } from '@/lib/cart';
import { evaluateCoupon } from '@/lib/pricing';
import { getSession } from '@/lib/auth';

export interface CartActionState {
  ok: boolean;
  message: string;
  /** Se usa para animar el ícono del carrito tras agregar. */
  added?: boolean;
}

const MAX_PER_LINE = 10;

const addSchema = z.object({
  variantId: z.string().min(1, 'Selecciona una talla.'),
  quantity: z.coerce.number().int().min(1).max(MAX_PER_LINE).default(1),
});

export async function addToCart(
  _prev: CartActionState | null,
  formData: FormData,
): Promise<CartActionState> {
  const parsed = addSchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity') ?? 1,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Selecciona una talla.' };
  }

  const variant = await prisma.variant.findUnique({
    where: { id: parsed.data.variantId },
    include: { product: { select: { status: true, name: true } }, color: { select: { name: true } } },
  });

  if (!variant || !variant.active || variant.product.status !== 'ACTIVE') {
    return { ok: false, message: 'Ese producto no está disponible.' };
  }

  const available = Math.max(0, variant.stock - variant.reserved);
  if (available <= 0) {
    return { ok: false, message: 'Esa talla está agotada. Avísanos y te contamos cuándo repone.' };
  }

  const cart = await getOrCreateCart();
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
  });

  const desired = (existing?.quantity ?? 0) + parsed.data.quantity;
  const quantity = Math.min(desired, available, MAX_PER_LINE);

  if (existing && quantity === existing.quantity) {
    return {
      ok: false,
      message: `Solo quedan ${available} unidades de la talla ${variant.size} en ${variant.color.name}.`,
    };
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: { cartId: cart.id, variantId: variant.id, quantity },
    update: { quantity },
  });

  revalidatePath('/carrito');
  revalidatePath('/', 'layout');

  return {
    ok: true,
    added: true,
    message: `${variant.product.name} · ${variant.color.name} · Talla ${variant.size} agregado.`,
  };
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartActionState> {
  const token = await readCartToken();
  if (!token) return { ok: false, message: 'Tu carrito expiró.' };

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { token } },
    include: { variant: true },
  });
  if (!item) return { ok: false, message: 'No encontramos ese producto en tu carrito.' };

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    revalidatePath('/carrito');
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Producto eliminado.' };
  }

  const available = Math.max(0, item.variant.stock - item.variant.reserved);
  const next = Math.min(quantity, available, MAX_PER_LINE);

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: next } });
  revalidatePath('/carrito');
  revalidatePath('/', 'layout');

  if (next < quantity) {
    return { ok: false, message: `Solo quedan ${available} unidades disponibles.` };
  }
  return { ok: true, message: 'Carrito actualizado.' };
}

export async function removeCartItem(itemId: string): Promise<CartActionState> {
  return updateCartItem(itemId, 0);
}

export async function applyCoupon(
  _prev: CartActionState | null,
  formData: FormData,
): Promise<CartActionState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const token = await readCartToken();
  if (!token) return { ok: false, message: 'Tu carrito está vacío.' };

  const cart = await prisma.cart.findUnique({
    where: { token },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!cart || cart.items.length === 0) {
    return { ok: false, message: 'Agrega productos antes de aplicar un cupón.' };
  }

  if (!code) {
    await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    revalidatePath('/carrito');
    revalidatePath('/checkout');
    return { ok: true, message: 'Cupón quitado.' };
  }

  const session = await getSession();
  const evaluation = await evaluateCoupon(
    code,
    cart.items.map((i) => ({
      productId: i.variant.productId,
      unitPrice: i.variant.priceOverride ?? i.variant.product.basePrice,
      quantity: i.quantity,
    })),
    session?.email,
  );

  if (!evaluation.ok) {
    return { ok: false, message: evaluation.reason ?? 'El cupón no es válido.' };
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
  revalidatePath('/carrito');
  revalidatePath('/checkout');
  return { ok: true, message: `Cupón ${code} aplicado.` };
}
