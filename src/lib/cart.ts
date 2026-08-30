import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { prisma } from './db';
import { evaluateCoupon } from './pricing';
import { getSession } from './auth';
import { colorLabel } from './colors';

const CART_COOKIE = 'taupoc_cart';
const CART_MAX_AGE = 60 * 60 * 24 * 45;

export interface CartLine {
  itemId: string;
  variantId: string;
  productId: string;
  slug: string;
  productName: string;
  modelCode: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  weightGrams: number;
  /** Stock disponible ahora mismo, para avisar si bajó desde que se agregó. */
  available: number;
  /** La cantidad pedida supera el stock disponible. */
  overStock: boolean;
}

export interface CartSummary {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponFreeShipping: boolean;
  couponError: string | null;
  weightGrams: number;
  hasIssues: boolean;
}

export const EMPTY_CART: CartSummary = {
  id: null,
  lines: [],
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  couponCode: null,
  couponFreeShipping: false,
  couponError: null,
  weightGrams: 0,
  hasIssues: false,
};

/** Token del carrito desde el cookie. No crea nada. */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Token del carrito, creando el cookie si hace falta. Solo en acciones/rutas mutables. */
export async function ensureCartToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;
  const token = randomUUID();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CART_MAX_AGE,
  });
  return token;
}

export async function getOrCreateCart() {
  const token = await ensureCartToken();
  const session = await getSession();
  const existing = await prisma.cart.findUnique({ where: { token } });
  if (existing) {
    // Asocia el carrito anónimo al usuario cuando inicia sesión.
    if (session && existing.userId !== session.id) {
      return prisma.cart.update({ where: { id: existing.id }, data: { userId: session.id } });
    }
    return existing;
  }
  return prisma.cart.create({ data: { token, userId: session?.id ?? null } });
}

const LINE_INCLUDE = {
  variant: {
    include: {
      color: true,
      product: { include: { images: { orderBy: { sortOrder: 'asc' as const } } } },
    },
  },
} as const;

/** Resumen completo del carrito con precios y stock recalculados en el servidor. */
export async function getCart(): Promise<CartSummary> {
  const token = await readCartToken();
  if (!token) return EMPTY_CART;

  const cart = await prisma.cart.findUnique({
    where: { token },
    include: { items: { include: LINE_INCLUDE, orderBy: { createdAt: 'asc' } } },
  });
  if (!cart) return EMPTY_CART;

  const lines: CartLine[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const unitPrice = v.priceOverride ?? p.basePrice;
    const image =
      p.images.find((i) => i.colorId === v.colorId) ??
      p.images.find((i) => i.isPrimary) ??
      p.images[0] ??
      null;
    const available = Math.max(0, v.stock - v.reserved);
    return {
      itemId: item.id,
      variantId: v.id,
      productId: p.id,
      slug: p.slug,
      productName: p.name,
      modelCode: p.modelCode,
      colorName: colorLabel(v.color),
      colorHex: v.color.hex,
      size: v.size,
      sku: v.sku,
      imageUrl: image?.url ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      weightGrams: p.weightGrams,
      available,
      overStock: item.quantity > available,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const weightGrams = lines.reduce((s, l) => s + l.weightGrams * l.quantity, 0);

  const session = await getSession();
  const evaluation = await evaluateCoupon(
    cart.couponCode,
    lines.map((l) => ({ productId: l.productId, unitPrice: l.unitPrice, quantity: l.quantity })),
    session?.email,
  );

  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    discount: evaluation.ok ? evaluation.discount : 0,
    couponCode: evaluation.ok ? (cart.couponCode ?? null) : null,
    couponFreeShipping: evaluation.ok && evaluation.freeShipping,
    couponError: cart.couponCode && !evaluation.ok ? (evaluation.reason ?? 'Cupón inválido.') : null,
    weightGrams,
    hasIssues: lines.some((l) => l.overStock),
  };
}

/** Solo la cantidad de ítems, para el badge del header. */
export async function getCartCount(): Promise<number> {
  const token = await readCartToken();
  if (!token) return 0;
  const result = await prisma.cartItem.aggregate({
    where: { cart: { token } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });
}
