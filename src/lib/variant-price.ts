/**
 * Precio de una talla con su oferta.
 *
 * Una talla puede tener un precio propio (`priceOverride`) y, encima, un
 * descuento por porcentaje con fecha de término (`salePercent`, `saleEndsAt`).
 * Todo lo que cobra o muestra un precio pasa por acá: carrito, checkout,
 * pedidos del panel, ficha y tarjeta. Si cada uno hiciera la cuenta por su
 * lado, la ficha podría decir un precio y el carrito cobrar otro.
 *
 * Sin `server-only`: no toca la base y la tarjeta lo puede usar igual.
 */

export interface VariantPriceInput {
  priceOverride: number | null;
  salePercent?: number | null;
  saleEndsAt?: Date | string | null;
}

export interface VariantPrice {
  /** Lo que se cobra hoy. */
  price: number;
  /** Precio normal de la talla, sin la oferta. Igual a `price` si no hay oferta. */
  regular: number;
  /** Porcentaje de la oferta vigente, o null. */
  percent: number | null;
  /** Fin de la oferta vigente, en ISO, o null si no tiene fecha de término. */
  endsAt: string | null;
}

/** Tope del descuento por talla: más allá ya es un error de tipeo. */
export const MAX_SALE_PERCENT = 90;

/** Desde cuántas unidades se muestra "Quedan solo N" si la talla no dice otra cosa. */
export const DEFAULT_SCARCITY_FROM = 3;

/** Si la oferta de la talla está vigente en este momento. */
export function saleActive(v: Pick<VariantPriceInput, 'salePercent' | 'saleEndsAt'>, now = new Date()): boolean {
  const pct = v.salePercent ?? 0;
  if (pct <= 0 || pct > MAX_SALE_PERCENT) return false;
  if (!v.saleEndsAt) return true;
  return new Date(v.saleEndsAt).getTime() > now.getTime();
}

/**
 * Aplica un porcentaje a un monto en CLP. Redondea a la decena: un precio
 * terminado en 7 pesos se ve como error y además no hay monedas de 1.
 */
export function applyPercent(amount: number, percent: number): number {
  return Math.max(0, Math.round((amount * (100 - percent)) / 1000) * 10);
}

export function variantPrice(v: VariantPriceInput, basePrice: number, now = new Date()): VariantPrice {
  const regular = v.priceOverride ?? basePrice;
  if (!saleActive(v, now)) return { price: regular, regular, percent: null, endsAt: null };
  const percent = v.salePercent as number;
  return {
    price: applyPercent(regular, percent),
    regular,
    percent,
    endsAt: v.saleEndsAt ? new Date(v.saleEndsAt).toISOString() : null,
  };
}

/** Solo el monto a cobrar. */
export function unitPriceOf(v: VariantPriceInput, basePrice: number, now = new Date()): number {
  return variantPrice(v, basePrice, now).price;
}

/** Umbral efectivo del badge de escasez de una talla. */
export function scarcityThreshold(v: { scarcityFrom?: number | null }): number {
  return v.scarcityFrom ?? DEFAULT_SCARCITY_FROM;
}

/** Si la talla debe mostrar "Quedan solo N". */
export function isScarce(available: number, v: { scarcityFrom?: number | null }): boolean {
  return available > 0 && available <= scarcityThreshold(v);
}
