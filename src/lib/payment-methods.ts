/**
 * Medios de pago del checkout y su descuento.
 *
 * Vive fuera de los módulos `server-only` porque el formulario de checkout
 * necesita calcular el mismo total que después cobra el servidor: si cada
 * lado redondeara a su manera, el cliente vería un monto y pagaría otro.
 */

export type PaymentMethodId = 'MERCADOPAGO' | 'TRANSFER' | 'PAYPAL' | 'MANUAL';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodId, string> = {
  MANUAL: 'Manual',
  MERCADOPAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia bancaria',
  PAYPAL: 'PayPal',
};

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  /** Porcentaje de descuento sobre los productos, de 0 a 100. */
  discountPercent: number;
}

/** Lo mínimo de la configuración que define los medios de pago. */
export interface PaymentMethodSettings {
  mercadoPagoEnabled: boolean;
  mercadoPagoDiscount: number;
  transferEnabled: boolean;
  transferDiscount: number;
  /** PayPal tiene credenciales y tipo de cambio: se ofrece fuera de Chile. */
  paypalEnabled?: boolean;
}

/** Medios habilitados, en el orden en que se ofrecen. */
export function paymentMethodOptions(settings: PaymentMethodSettings): PaymentMethodOption[] {
  const options: PaymentMethodOption[] = [];
  if (settings.mercadoPagoEnabled) {
    options.push({
      id: 'MERCADOPAGO',
      label: PAYMENT_METHOD_LABEL.MERCADOPAGO,
      discountPercent: clampPercent(settings.mercadoPagoDiscount),
    });
  }
  if (settings.transferEnabled) {
    options.push({
      id: 'TRANSFER',
      label: PAYMENT_METHOD_LABEL.TRANSFER,
      discountPercent: clampPercent(settings.transferDiscount),
    });
  }
  if (settings.paypalEnabled) {
    options.push({ id: 'PAYPAL', label: PAYMENT_METHOD_LABEL.PAYPAL, discountPercent: 0 });
  }
  return options;
}

/**
 * Medios que se ofrecen según el destino: dentro de Chile los de siempre;
 * al extranjero solo PayPal, que cobra en dólares y acepta tarjetas de afuera.
 */
export function methodsForDestination(
  options: PaymentMethodOption[],
  international: boolean,
): PaymentMethodOption[] {
  return options.filter((o) => (o.id === 'PAYPAL') === international);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Descuento del medio de pago. Se aplica sobre los productos ya descontado el
 * cupón: el despacho nunca se descuenta y los descuentos no se suman sobre la
 * misma base.
 */
export function paymentMethodDiscount(productsTotal: number, percent: number): number {
  const base = Math.max(0, productsTotal);
  return Math.round((base * clampPercent(percent)) / 100);
}
