import 'server-only';
import type { Coupon } from '@prisma/client';
import { prisma } from './db';
import type { Storefront } from './storefront';

export interface PriceableLine {
  productId: string | null;
  unitPrice: number;
  quantity: number;
}

/** Las líneas y el descuento usan la unidad menor de esta moneda. Los cupones se guardan en CLP. */
export type CouponCurrency = { currency: 'CLP' } | { currency: 'USD'; clpPerUsd: number };

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
  currency: CouponCurrency = { currency: 'CLP' },
  storefront: Storefront = 'CL',
): Promise<CouponEvaluation> {
  if (!code) return NO_DISCOUNT;
  if (
    currency.currency === 'USD' &&
    (!Number.isFinite(currency.clpPerUsd) || currency.clpPerUsd <= 0)
  ) {
    return { ...NO_DISCOUNT, reason: 'El tipo de cambio no está disponible.' };
  }
  // El valor nominal del cupón no lleva IVA, margen ni redondeo comercial de productos.
  const convert = (clp: number) =>
    currency.currency === 'USD' ? (clp / currency.clpPerUsd) * 100 : clp;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: true },
  });

  if (!coupon || !coupon.active) {
    return { ...NO_DISCOUNT, reason: 'El cupón no existe o está inactivo.' };
  }
  if (storefront === 'INTL' && coupon.type === 'FREE_SHIPPING') {
    return { ...NO_DISCOUNT, reason: 'Este cupón de envío gratis solo es válido en taupoc.cl.' };
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
  if (coupon.minSubtotal && subtotal < Math.ceil(convert(coupon.minSubtotal))) {
    return {
      ...NO_DISCOUNT,
      reason: `El cupón requiere una compra mínima.`,
      coupon,
    };
  }

  if (coupon.perUserLimit != null && userEmail) {
    const used = await prisma.order.count({
      where: {
        couponId: coupon.id,
        email: { equals: userEmail.trim(), mode: 'insensitive' },
        paymentStatus: 'APPROVED',
      },
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
  return {
    ok: true,
    coupon,
    discount: Math.min(base, Math.max(0, Math.round(convert(coupon.value)))),
    freeShipping: false,
  };
}
