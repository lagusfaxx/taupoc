'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCart, clearCart } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { getShippingOptions, resolveShippingOption, type ShippingOption } from '@/lib/shipping';
import { getSettings } from '@/lib/settings';
import { nextOrderNumber, logOrderEvent } from '@/lib/orders';
import { createPreference, mpConfigured } from '@/lib/mercadopago';
import { sendAdminTransferPending, sendOrderPlaced, type OrderMailData } from '@/lib/mail';
import { paymentMethodDiscount, paymentMethodOptions } from '@/lib/payment-methods';
import { isValidRut } from '@/lib/chile';
import {
  enviaQuotes,
  enviaStates,
  enviaZip,
  type EnviaDestination,
  type EnviaQuote,
  type EnviaState,
  type EnviaZipMatch,
} from '@/lib/envia';

export interface CheckoutState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

/** Opciones de envío para la región elegida. Se consulta desde el cliente. */
export async function fetchShippingOptions(region: string | null): Promise<ShippingOption[]> {
  const cart = await getCart();
  if (cart.lines.length === 0) return [];
  return getShippingOptions({
    region,
    subtotal: cart.subtotal - cart.discount,
    weightGrams: cart.weightGrams,
  });
}

/** Convierte una cotización de Envía al formato de opción que ya pinta el checkout. */
const CARRIER_NAMES: Record<string, string> = { fedex: 'FedEx', dhl: 'DHL', ups: 'UPS', usps: 'USPS' };

/** "FEDEX INTERNATIONAL PRIORITY®" → "International Priority": el courier ya va en su logo. */
function serviceName(label: string, carrier: string): string {
  const clean = label
    .replace(/[®™]/g, '')
    .replace(new RegExp(`^\\s*${carrier}\\s*`, 'i'), '')
    .replace(/\binternacional\b/gi, 'International')
    .trim();
  if (!clean) return label;
  // Algunas paqueterías mandan todo en mayúsculas: se pasa a tipo título.
  const titled = label === label.toUpperCase() ? clean.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : clean;
  return titled.charAt(0).toUpperCase() + titled.slice(1);
}

function enviaOption(q: EnviaQuote): ShippingOption {
  const key = q.carrier.toLowerCase();
  return {
    rateId: q.rateId,
    carrier: CARRIER_NAMES[key] ?? q.carrier.charAt(0).toUpperCase() + q.carrier.slice(1),
    label: serviceName(q.label, key),
    description: q.deliveryEstimate ? `Entrega estimada: ${q.deliveryEstimate}` : null,
    price: q.price,
    freeApplied: false,
    isPickup: false,
    pickupInfo: null,
    etaMinDays: 0,
    etaMaxDays: 0,
    zoneName: 'Internacional',
  };
}

/** Estados / provincias del país extranjero elegido, desde Envía. */
export async function fetchStates(country: string): Promise<EnviaState[]> {
  return enviaStates(country);
}

/** Autocompleta estado y ciudad a partir del código postal. */
export async function lookupZip(country: string, zip: string): Promise<EnviaZipMatch | null> {
  return enviaZip(country, zip);
}

/** Cotiza con Envía el despacho al extranjero. Solo se usa si el país no es Chile. */
export async function fetchInternationalOptions(
  dest: Omit<EnviaDestination, 'name' | 'email' | 'phone'>,
): Promise<{ options: ShippingOption[]; error: string | null }> {
  const cart = await getCart();
  if (cart.lines.length === 0 || !dest.country || dest.country === 'CL') return { options: [], error: null };
  if (!dest.city || !dest.postalCode) return { options: [], error: null };
  const { quotes, error } = await enviaQuotes({ ...dest, name: '', email: '', phone: '' }, cart.weightGrams);
  return { options: quotes.map(enviaOption), error };
}

const checkoutSchema = z
  .object({
    email: z.string().email('Ingresa un correo válido.'),
    firstName: z.string().min(2, 'Ingresa tu nombre.'),
    lastName: z.string().min(2, 'Ingresa tu apellido.'),
    phone: z.string().min(8, 'Ingresa un teléfono de contacto.'),
    rut: z.string().optional(),
    country: z.string().regex(/^[A-Z]{2}$/).default('CL'),
    state: z.string().optional(),
    city: z.string().optional(),
    shippingRateId: z.string().min(1, 'Selecciona una forma de entrega.'),
    region: z.string().optional(),
    commune: z.string().optional(),
    street: z.string().optional(),
    streetNumber: z.string().optional(),
    addressExtra: z.string().optional(),
    postalCode: z.string().optional(),
    customerNote: z.string().max(500).optional(),
    paymentMethod: z.enum(['MERCADOPAGO', 'TRANSFER'], {
      errorMap: () => ({ message: 'Elige cómo quieres pagar.' }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.rut && data.rut.trim() && !isValidRut(data.rut)) {
      ctx.addIssue({ code: 'custom', path: ['rut'], message: 'El RUT no es válido.' });
    }
  });

/**
 * Crea el pedido y la preferencia de pago.
 *
 * El pedido nace en PENDING y no descuenta stock: el descuento ocurre cuando
 * el webhook de Mercado Pago confirma el pago, o cuando el equipo confirma la
 * transferencia desde el panel. Así un checkout abandonado nunca deja stock
 * bloqueado.
 */
export async function createCheckout(
  _prev: CheckoutState | null,
  formData: FormData,
): Promise<CheckoutState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = checkoutSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors };
  }
  const data = parsed.data;

  const cart = await getCart();
  if (cart.lines.length === 0) {
    return { ok: false, message: 'Tu carrito está vacío.' };
  }
  if (cart.hasIssues) {
    return { ok: false, message: 'Hay productos sin stock suficiente. Ajusta el carrito.' };
  }

  const international = data.country !== 'CL';

  if (international) {
    const missing: Record<string, string> = {};
    if (!data.city) missing.city = 'Ingresa tu ciudad.';
    if (!data.postalCode) missing.postalCode = 'Ingresa el código postal.';
    if (!data.street || data.street.length < 3) missing.street = 'Ingresa tu calle.';
    if (!data.streetNumber) missing.streetNumber = 'Ingresa el número.';
    if (Object.keys(missing).length > 0) {
      return { ok: false, message: 'Completa la dirección de despacho.', fieldErrors: missing };
    }
  }

  // El costo de envío se recalcula en el servidor: nunca se confía en el cliente.
  // Al extranjero se vuelve a cotizar con Envía y se busca la misma paquetería y servicio.
  const shipping = international
    ? ((
        await enviaQuotes(
          {
            country: data.country,
            state: data.state ?? '',
            city: data.city ?? '',
            postalCode: data.postalCode ?? '',
            street: data.street ?? '',
            number: data.streetNumber ?? '',
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            phone: data.phone,
          },
          cart.weightGrams,
        )
      ).quotes
        .map(enviaOption)
        .find((o) => o.rateId === data.shippingRateId) ?? null)
    : await resolveShippingOption(data.shippingRateId, {
        region: data.region ?? null,
        subtotal: cart.subtotal - cart.discount,
        weightGrams: cart.weightGrams,
      });
  if (!shipping) {
    return { ok: false, message: 'La forma de entrega elegida ya no está disponible.' };
  }

  if (!shipping.isPickup && !international) {
    const missing: Record<string, string> = {};
    if (!data.region) missing.region = 'Selecciona tu región.';
    if (!data.commune) missing.commune = 'Selecciona tu comuna.';
    if (!data.street || data.street.length < 3) missing.street = 'Ingresa tu calle.';
    if (!data.streetNumber) missing.streetNumber = 'Ingresa el número.';
    if (Object.keys(missing).length > 0) {
      return { ok: false, message: 'Completa la dirección de despacho.', fieldErrors: missing };
    }
  }

  const settings = await getSettings();
  const session = await getSession();

  // El medio de pago y su descuento también se validan acá: un medio
  // deshabilitado en el panel no se acepta aunque llegue en el formulario.
  const method = paymentMethodOptions(settings).find((o) => o.id === data.paymentMethod);
  if (!method) {
    return {
      ok: false,
      message: 'El medio de pago elegido ya no está disponible.',
      fieldErrors: { paymentMethod: 'Elige otro medio de pago.' },
    };
  }
  const isTransfer = method.id === 'TRANSFER';

  const productsTotal = cart.subtotal - cart.discount;
  const paymentDiscount = paymentMethodDiscount(productsTotal, method.discountPercent);
  const discountTotal = cart.discount + paymentDiscount;
  const shippingTotal = cart.couponFreeShipping ? 0 : shipping.price;
  const total = Math.max(0, cart.subtotal - discountTotal + shippingTotal);

  const coupon = cart.couponCode
    ? await prisma.coupon.findUnique({ where: { code: cart.couponCode } })
    : null;

  const number = await nextOrderNumber();

  const order = await prisma.order.create({
    data: {
      number,
      userId: session?.id ?? null,
      email: data.email.toLowerCase().trim(),
      phone: data.phone,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: method.id,
      subtotal: cart.subtotal,
      discountTotal,
      paymentDiscount,
      shippingTotal,
      total,
      couponId: coupon?.id ?? null,
      couponCode: cart.couponCode,
      shippingRateId: shipping.rateId,
      shippingLabel: shipping.label,
      shippingCarrier: shipping.carrier,
      isPickup: shipping.isPickup,
      firstName: data.firstName,
      lastName: data.lastName,
      street: shipping.isPickup ? null : data.street,
      streetNumber: shipping.isPickup ? null : data.streetNumber,
      addressExtra: shipping.isPickup ? null : data.addressExtra,
      country: shipping.isPickup ? 'CL' : data.country,
      commune: shipping.isPickup ? null : international ? data.city : data.commune,
      city: shipping.isPickup ? null : international ? data.city : data.commune,
      region: shipping.isPickup ? null : international ? data.state : data.region,
      postalCode: shipping.isPickup ? null : data.postalCode,
      customerNote: data.customerNote,
      items: {
        create: cart.lines.map((line) => ({
          variantId: line.variantId,
          productId: line.productId,
          productName: line.productName,
          colorName: line.colorName,
          size: line.size,
          sku: line.sku,
          imageUrl: line.imageUrl,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  await logOrderEvent({
    orderId: order.id,
    type: 'created',
    message: `Pedido creado por ${data.email}. Entrega: ${shipping.label}. Pago: ${method.label}.`,
  });

  if (session && data.rut) {
    await prisma.user.update({ where: { id: session.id }, data: { rut: data.rut } }).catch(() => {});
  }

  const mailData: OrderMailData = {
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    paymentDiscount: order.paymentDiscount,
    paymentMethod: order.paymentMethod,
    couponCode: order.couponCode,
    shippingTotal: order.shippingTotal,
    total: order.total,
    shippingLabel: order.shippingLabel,
    isPickup: order.isPickup,
    street: order.street,
    streetNumber: order.streetNumber,
    commune: order.commune,
    region: order.region,
    items: order.items,
  };

  await sendOrderPlaced(mailData).catch(() => {});

  if (isTransfer) {
    // Sin pasarela de por medio: el pedido espera a que el equipo vea el
    // abono y lo confirme desde el panel. Ahí sigue el camino de siempre.
    await logOrderEvent({
      orderId: order.id,
      type: 'transfer_pending',
      message: 'Esperando la transferencia del cliente.',
    });
    await sendAdminTransferPending(mailData).catch(() => {});
    if (cart.id) await clearCart(cart.id);
    revalidatePath('/', 'layout');
    redirect(`/checkout/resultado?order=${order.number}&estado=transferencia`);
  }

  if (!mpConfigured()) {
    // Sin credenciales de Mercado Pago no se puede cobrar: el pedido queda
    // registrado y se avisa al cliente para coordinar el pago manualmente.
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_unavailable',
      message: 'Mercado Pago no está configurado. Pedido pendiente de cobro manual.',
    });
    if (cart.id) await clearCart(cart.id);
    revalidatePath('/', 'layout');
    redirect(`/checkout/resultado?order=${order.number}&estado=sin-pasarela`);
  }

  let initPoint: string;
  try {
    const preference = await createPreference({
      orderId: order.id,
      orderNumber: order.number,
      items: cart.lines.map((line) => ({
        id: line.sku,
        title: `${line.productName} · ${line.colorName} · T${line.size}`,
        description: line.modelCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        pictureUrl: line.imageUrl,
      })),
      shippingCost: shippingTotal,
      discount: discountTotal,
      payer: {
        name: data.firstName,
        surname: data.lastName,
        email: order.email,
        phone: data.phone,
      },
      maxInstallments: settings.installmentsMax,
    });
    initPoint = preference.initPoint;
    await prisma.order.update({
      where: { id: order.id },
      data: { mpPreferenceId: preference.id },
    });
  } catch (error) {
    console.error('[checkout:mp-error]', error);
    await logOrderEvent({
      orderId: order.id,
      type: 'payment_error',
      message: 'No se pudo crear la preferencia de pago en Mercado Pago.',
    });
    return {
      ok: false,
      message:
        'No pudimos conectar con Mercado Pago. Tu pedido quedó guardado como ' +
        `${order.number}; escríbenos y lo retomamos.`,
    };
  }

  if (cart.id) await clearCart(cart.id);
  revalidatePath('/', 'layout');
  redirect(initPoint);
}
