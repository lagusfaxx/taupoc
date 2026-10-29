import { z } from 'zod';
import { REGIONS } from './chile';
const money = z.coerce.number().int().min(0).max(100_000_000);
export const adminOrderSchema = z
  .object({
    creationKey: z.string().uuid(),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    firstName: z.string().trim().min(2, 'Ingresa el nombre.').max(100),
    lastName: z.string().trim().min(2, 'Ingresa el apellido.').max(100),
    phone: z.string().trim().min(8, 'Ingresa el teléfono.').max(30),
    status: z.enum(['PENDING', 'PAID', 'PROCESSING']),
    delivery: z.enum(['pickup', 'shipping']),
    shippingLabel: z.string().trim().min(1, 'Ingresa la forma de entrega.').max(150),
    shippingCarrier: z.string().trim().max(100).default(''),
    shippingTotal: money,
    discountTotal: money,
    street: z.string().trim().max(200).default(''),
    streetNumber: z.string().trim().max(30).default(''),
    addressExtra: z.string().trim().max(200).default(''),
    commune: z.string().trim().max(100).default(''),
    region: z.string().trim().max(10).default(''),
    customerNote: z.string().trim().max(500).default(''),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(100),
        }),
      )
      .min(1, 'Agrega al menos un producto.')
      .max(50),
  })
  .superRefine((d, ctx) => {
    if (new Set(d.items.map((i) => i.variantId)).size !== d.items.length)
      ctx.addIssue({ code: 'custom', message: 'Hay productos repetidos.', path: ['items'] });
    if (
      d.delivery === 'shipping' &&
      (!d.street ||
        !d.streetNumber ||
        !REGIONS.some((r) => r.code === d.region && r.communes.includes(d.commune)))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Completa la dirección, región y comuna de despacho.',
        path: ['street'],
      });
  });
