'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCart, clearCart } from '@/lib/cart';
import { getCurrentFx } from '@/lib/fx-server';
import { formatUsdCents, type FxConfig } from '@/lib/fx';
import { intlTotal, shippingCents, taxIdRule, type IntlCartPricing } from '@/lib/intl-checkout';
import { evaluateIntlCart } from '@/lib/intl-cart';
import {
  enviaQuotes,
  enviaStates,
  enviaZip,
  type EnviaState,
  type EnviaZipMatch,
} from '@/lib/envia';
import { nextOrderNumber, logOrderEvent } from '@/lib/orders';
import { createPaypalOrder, paypalConfigured } from '@/lib/paypal';
import { storeSiteUrl } from '@/lib/storefront';
import { getSettings } from '@/lib/settings';
import {
  OutOfStockError,
  reservationDeadline,
  reserveOrderStock,
  sweepExpiredReservations,
} from '@/lib/reservations';

/*
 * Checkout de taupoc.lat. Vive aparte del de taupoc.cl (actions/checkout.ts)
 * para no tocarlo: comparte el carrito, el stock, la reserva, los pedidos y
 * el cobro con PayPal, y cambia la moneda, la dirección y el envío.
 *
 * Todo se recalcula acá: precios en dólares con el tipo de cambio vigente y
 * envío cotizado de nuevo con Envía. Nada de lo que manda el navegador se usa
 * como monto.
 */

export interface IntlShippingOption {
  rateId: string;
  carrier: string;
  label: string;
  estimate: string | null;
  cents: number;
}

export interface IntlCheckoutState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  pricing?: IntlCartPricing;
  shippingOptions?: IntlShippingOption[];
  /** A dónde ir después: PayPal. El navegador navega con una carga completa. */
  redirectTo?: string;
}

const CARRIER_NAMES: Record<string, string> = {
  fedex: 'FedEx',
  dhl: 'DHL',
  ups: 'UPS',
  usps: 'USPS',
};

export async function intlStates(country: string): Promise<EnviaState[]> {
  return enviaStates(country);
}

export async function intlZip(country: string, zip: string): Promise<EnviaZipMatch | null> {
  return enviaZip(country, zip);
}

interface Destination {
  country: string;
  state: string;
  city: string;
  postalCode: string;
  street: string;
  number: string;
}

async function quote(
  dest: Destination,
  weightGrams: number,
  fx: FxConfig,
  contact?: { name: string; email: string; phone: string },
) {
  const { quotes, error } = await enviaQuotes(
    {
      ...dest,
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
    },
    weightGrams,
  );
  return {
    options: quotes.map((q) => ({
      rateId: q.rateId,
      carrier: CARRIER_NAMES[q.carrier.toLowerCase()] ?? q.carrier,
      label: q.label.replace(/[®™]/g, '').trim(),
      estimate: q.deliveryEstimate,
      cents: shippingCents(q.price, fx),
    })),
    error,
  };
}

/** Opciones de envío para la dirección escrita, en dólares. */
export async function intlShippingOptions(
  dest: Destination,
): Promise<{ options: IntlShippingOption[]; error: string | null }> {
  const [cart, fx] = await Promise.all([getCart(), getCurrentFx()]);
  if (!fx) return { options: [], error: 'Tipo de cambio no configurado.' };
  if (cart.lines.length === 0 || !dest.country || dest.country === 'CL')
    return { options: [], error: null };
  if (!dest.city || !dest.postalCode) return { options: [], error: null };
  return quote(dest, cart.weightGrams, fx);
}

const schema = z.object({
  email: z.string().trim().email('Ingresa un correo válido.'),
  firstName: z.string().trim().min(2, 'Ingresa tu nombre.'),
  lastName: z.string().trim().min(2, 'Ingresa tu apellido.'),
  phone: z.string().trim().min(6, 'Ingresa un teléfono con código de país.'),
  country: z.string().regex(/^[A-Z]{2}$/, 'Elige el país de destino.'),
  state: z.string().trim().optional(),
  city: z.string().trim().min(2, 'Ingresa la ciudad.'),
  postalCode: z.string().trim().min(2, 'Ingresa el código postal.'),
  street: z.string().trim().min(3, 'Ingresa la calle.'),
  streetNumber: z.string().trim().min(1, 'Ingresa el número.'),
  addressExtra: z.string().trim().max(120).optional(),
  taxId: z.string().trim().max(40).optional(),
  shippingRateId: z.string().min(1, 'Elige cómo enviar tu pedido.'),
  duties: z.literal('on', {
    errorMap: () => ({ message: 'Confirma que los impuestos de importación son por tu cuenta.' }),
  }),
  customerNote: z.string().max(500).optional(),
  expectedTotalCents: z.coerce.number().int().nonnegative(),
  expectedCouponCode: z.string().max(100),
});

export async function placeIntlOrder(
  _prev: IntlCheckoutState | null,
  formData: FormData,
): Promise<IntlCheckoutState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors };
  }
  const d = parsed.data;
  if (d.country === 'CL')
    return { ok: false, message: 'Para envíos dentro de Chile compra en taupoc.cl.' };
  const taxRule = taxIdRule(d.country);
  if (taxRule.required && !d.taxId) {
    return {
      ok: false,
      message: 'Revisa los datos marcados.',
      fieldErrors: { taxId: `Ingresa tu ${taxRule.label}: la aduana lo pide para entregar.` },
    };
  }
  if (!paypalConfigured())
    return { ok: false, message: 'El pago con PayPal no está disponible en este momento.' };

  const [cart, fx, settings] = await Promise.all([getCart(), getCurrentFx(), getSettings()]);
  if (!fx) return { ok: false, message: 'Los precios no están disponibles en este momento.' };
  if (cart.lines.length === 0) return { ok: false, message: 'Tu carrito está vacío.' };
  if (cart.hasIssues)
    return { ok: false, message: 'Hay productos sin stock suficiente. Ajusta el carrito.' };

  const { lines, coupon, pricing } = await evaluateIntlCart(cart, fx, d.email);
  if (pricing.couponError) return { ok: false, message: pricing.couponError, pricing };

  // Envío: se vuelve a cotizar y se busca la misma opción.
  const dest = {
    country: d.country,
    state: d.state ?? '',
    city: d.city,
    postalCode: d.postalCode,
    street: d.street,
    number: d.streetNumber,
  };
  const { options } = await quote(dest, cart.weightGrams, fx, {
    name: `${d.firstName} ${d.lastName}`,
    email: d.email,
    phone: d.phone,
  });
  const shipping = options.find((o) => o.rateId === d.shippingRateId);
  if (!shipping)
    return { ok: false, message: 'La opción de envío ya no está disponible. Elige otra.' };

  // Precios en dólares por línea; los montos del pedido quedan en su
  // equivalente en pesos para que reportes y panel sigan sumando en CLP.
  const { subtotalCents, discountCents } = pricing;
  const { totalCents, shippingCents: freightCents } = intlTotal(pricing, shipping.cents);
  // El navegador solo confirma lo que vio; jamás determina el monto a cobrar.
  if (totalCents !== d.expectedTotalCents || (pricing.couponCode ?? '') !== d.expectedCouponCode) {
    return {
      ok: false,
      message: 'El total cambió. Revisa el resumen actualizado y vuelve a confirmar el pago.',
      pricing,
      shippingOptions: options,
    };
  }
  if (totalCents <= 0)
    return {
      ok: false,
      message:
        'PayPal requiere un total mayor a cero. Contáctanos para completar este pedido sin cobro.',
    };
  const toClp = (cents: number) => Math.round((cents / 100) * fx.clpPerUsd);
  const subtotalClp = toClp(subtotalCents);
  const discountClp = toClp(discountCents);
  const freightClp = toClp(freightCents);

  await sweepExpiredReservations();
  const reservedUntil = reservationDeadline('PAYPAL', settings);
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const number = await nextOrderNumber(tx);
      const created = await tx.order.create({
        data: {
          number,
          storefront: 'INTL',
          email: d.email.toLowerCase(),
          phone: d.phone,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'PAYPAL',
          subtotal: subtotalClp,
          discountTotal: discountClp,
          shippingTotal: freightClp,
          total: subtotalClp - discountClp + freightClp,
          couponId: coupon.ok ? coupon.coupon!.id : null,
          couponCode: pricing.couponCode,
          chargedCurrency: 'USD',
          chargedCents: totalCents,
          shippingRateId: shipping.rateId,
          shippingLabel: shipping.label,
          shippingCarrier: shipping.carrier,
          isPickup: false,
          country: d.country,
          firstName: d.firstName,
          lastName: d.lastName,
          street: d.street,
          streetNumber: d.streetNumber,
          addressExtra: d.addressExtra || null,
          city: d.city,
          commune: d.city,
          region: d.state || null,
          postalCode: d.postalCode,
          buyerTaxId: d.taxId || null,
          dutiesAcceptedAt: new Date(),
          customerNote: d.customerNote || null,
          items: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              productName: l.productName,
              colorName: l.colorName,
              size: l.size,
              sku: l.sku,
              imageUrl: l.imageUrl,
              unitPrice: toClp(l.unitCents),
              quantity: l.quantity,
              lineTotal: toClp(l.lineCents),
            })),
          },
        },
      });
      await reserveOrderStock(tx, created.id, reservedUntil);
      return created;
    });
  } catch (error) {
    if (error instanceof OutOfStockError) return { ok: false, message: error.customerMessage };
    throw error;
  }

  await logOrderEvent({
    orderId: order.id,
    type: 'created',
    message:
      `Pedido de taupoc.lat por ${d.email}: ${formatUsdCents(subtotalCents)} en productos − ${formatUsdCents(discountCents)} de descuento${pricing.couponCode ? ` (${pricing.couponCode})` : ''} + ${formatUsdCents(freightCents)} ` +
      `de envío (${shipping.carrier} ${shipping.label}) = ${formatUsdCents(totalCents)}. Tipo de cambio ${fx.clpPerUsd}, ` +
      `margen ${fx.marginPct} %. Documento: ${d.taxId || '—'}. Aceptó que los impuestos de importación son por su cuenta.`,
  });

  try {
    const paypal = await createPaypalOrder({
      orderId: order.id,
      orderNumber: order.number,
      amountCents: totalCents,
      baseUrl: storeSiteUrl('INTL'),
      brandName: 'TAUPOC',
    });
    await prisma.order.update({ where: { id: order.id }, data: { paypalOrderId: paypal.id } });
    if (cart.id) await clearCart(cart.id);
    return { ok: true, message: 'Te llevamos a PayPal…', redirectTo: paypal.approveUrl };
  } catch (error) {
    console.error('[checkout-intl:paypal]', error);
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_error',
      message: 'No se pudo crear la orden de pago en PayPal.',
    });
    return {
      ok: false,
      message: `No pudimos conectar con PayPal. Tu pedido quedó guardado como ${order.number}; escríbenos y lo retomamos.`,
    };
  }
}
