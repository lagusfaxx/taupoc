import 'server-only';
import type { CartSummary } from './cart';
import type { FxConfig } from './fx';
import { intlLine, type IntlCartPricing } from './intl-checkout';
import { evaluateCoupon } from './pricing';

/** Una sola evaluación en USD para carrito, checkout y cobro. Nunca reutiliza el descuento en CLP. */
export async function evaluateIntlCart(cart: CartSummary, fx: FxConfig, email?: string | null) {
  const lines = cart.lines.map((line) => ({ ...line, ...intlLine(line, fx) }));
  const coupon = await evaluateCoupon(
    cart.requestedCouponCode,
    lines.map((line) => ({
      productId: line.productId,
      unitPrice: line.unitCents,
      quantity: line.quantity,
    })),
    email,
    { currency: 'USD', clpPerUsd: fx.clpPerUsd },
  );
  const pricing: IntlCartPricing = {
    lines: lines.map((line) => ({
      itemId: line.itemId,
      name: line.productName,
      detail: `${line.colorName} · Talla ${line.size}`,
      quantity: line.quantity,
      lineCents: line.lineCents,
    })),
    subtotalCents: lines.reduce((sum, line) => sum + line.lineCents, 0),
    discountCents: coupon.ok ? coupon.discount : 0,
    freeShipping: coupon.ok && coupon.freeShipping,
    couponCode: coupon.ok ? coupon.coupon!.code : null,
    requestedCouponCode: cart.requestedCouponCode,
    couponError:
      cart.requestedCouponCode && !coupon.ok ? (coupon.reason ?? 'Cupón inválido.') : null,
  };
  return { lines, coupon, pricing };
}
