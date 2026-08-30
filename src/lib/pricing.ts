import 'server-only';
import type { Coupon } from '@prisma/client';
import { prisma } from './db';

export interface PriceableLine {
  productId: string | null;
  unitPrice: number;
  quantity: number;
}

export interface CouponEvaluation {
  ok: boolean;
  reason?: string;
  coupon?: Coupon;
  /** Descuento aplicado sobre los productos. */
  discount: number;
  /** El cupón cubre el costo de envío. */
  freeShipping: boolean;
}

const NO_DISCOUNT: CouponEvaluation = { ok: false, discount: 0, freeShipping: false };

/**
 * Evalúa un cupón contra las líneas del carrito.
 * Un cupón restringido a productos solo descuenta las líneas de esos productos.
 */
export async function evaluateCoupon(
  code: string | null | undefined,
  lines: PriceableLine[],
  userEmail?: string | null,
): Promise<CouponEvaluation> {
  if (!code) return NO_DISCOUNT;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: true },
  });

  if (!coupon || !coupon.active) {
    return { ...NO_DISCOUNT, reason: 'El cupón no existe o está inactivo.' };
  }
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ...NO_DISCOUNT, reason: 'El cupón todavía no está vigente.' };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ...NO_DISCOUNT, reason: 'El cupón está vencido.' };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ...NO_DISCOUNT, reason: 'El cupón alcanzó su límite de usos.' };
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      ...NO_DISCOUNT,
      reason: `El cupón requiere una compra mínima.`,
      coupon,
    };
  }

  if (coupon.perUserLimit != null && userEmail) {
    const used = await prisma.order.count({
      where: { couponId: coupon.id, email: userEmail, paymentStatus: 'APPROVED' },
    });
    if (used >= coupon.perUserLimit) {
      return { ...NO_DISCOUNT, reason: 'Ya usaste este cupón el máximo de veces permitido.' };
    }
  }

  // Base sobre la que se calcula: todo el carrito o solo los productos incluidos.
  const restricted = coupon.products.length > 0;
  const allowedIds = new Set(coupon.products.map((p) => p.productId));
  const base = restricted
    ? lines
        .filter((l) => l.productId && allowedIds.has(l.productId))
        .reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    : subtotal;

  if (restricted && base === 0) {
    return { ...NO_DISCOUNT, reason: 'El cupón no aplica a los productos del carrito.', coupon };
  }

  if (coupon.type === 'FREE_SHIPPING') {
    return { ok: true, coupon, discount: 0, freeShipping: true };
  }
  if (coupon.type === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, coupon.value));
    return { ok: true, coupon, discount: Math.round((base * pct) / 100), freeShipping: false };
  }
  // FIXED
  return { ok: true, coupon, discount: Math.min(base, Math.max(0, coupon.value)), freeShipping: false };
}
