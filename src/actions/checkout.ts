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
import { sendOrderPlaced } from '@/lib/mail';
import { isValidRut } from '@/lib/chile';

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

const checkoutSchema = z
  .object({
    email: z.string().email('Ingresa un correo válido.'),
    firstName: z.string().min(2, 'Ingresa tu nombre.'),
    lastName: z.string().min(2, 'Ingresa tu apellido.'),
    phone: z.string().min(8, 'Ingresa un teléfono de contacto.'),
    rut: z.string().optional(),
    shippingRateId: z.string().min(1, 'Selecciona una forma de entrega.'),
    region: z.string().optional(),
    commune: z.string().optional(),
    street: z.string().optional(),
    streetNumber: z.string().optional(),
    addressExtra: z.string().optional(),
    postalCode: z.string().optional(),
    customerNote: z.string().max(500).optional(),
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
 * el webhook de Mercado Pago confirma el pago. Así un checkout abandonado
 * nunca deja stock bloqueado.
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

  // El costo de envío se recalcula en el servidor: nunca se confía en el cliente.
  const shipping = await resolveShippingOption(data.shippingRateId, {
    region: data.region ?? null,
    subtotal: cart.subtotal - cart.discount,
    weightGrams: cart.weightGrams,
  });
  if (!shipping) {
    return { ok: false, message: 'La forma de entrega elegida ya no está disponible.' };
  }

  if (!shipping.isPickup) {
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

  const shippingTotal = cart.couponFreeShipping ? 0 : shipping.price;
  const total = Math.max(0, cart.subtotal - cart.discount + shippingTotal);

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
      subtotal: cart.subtotal,
      discountTotal: cart.discount,
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
      commune: shipping.isPickup ? null : data.commune,
      city: shipping.isPickup ? null : data.commune,
      region: shipping.isPickup ? null : data.region,
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
    message: `Pedido creado por ${data.email}. Entrega: ${shipping.label}.`,
  });

  if (session && data.rut) {
    await prisma.user.update({ where: { id: session.id }, data: { rut: data.rut } }).catch(() => {});
  }

  await sendOrderPlaced({
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    shippingLabel: order.shippingLabel,
    isPickup: order.isPickup,
    street: order.street,
    streetNumber: order.streetNumber,
    commune: order.commune,
    region: order.region,
    items: order.items,
  }).catch(() => {});

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
      discount: cart.discount,
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
