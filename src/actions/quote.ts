'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { sendQuoteRequestAlert } from '@/lib/mail';
import { getStore } from '@/lib/storefront-server';

export interface QuoteState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  clubName: z.string().min(2, 'Ingresa el nombre del club.'),
  contactName: z.string().min(2, 'Ingresa tu nombre.'),
  email: z.string().email('Ingresa un correo válido.'),
  phone: z.string().min(8, 'Ingresa un teléfono de contacto.'),
  region: z.string().optional(),
  athletes: z.coerce.number().int().min(1).max(2000).optional(),
  interest: z.string().optional(),
  message: z.string().max(1500).optional(),
  // Campo trampa para bots: si viene con contenido, se descarta en silencio.
  website: z.string().max(0).optional(),
});

const storeSchema = z.object({
  clubName: z.string().trim().min(2, 'Ingresa el nombre de la tienda.'),
  contactName: z.string().trim().min(2, 'Ingresa tu nombre.'),
  email: z.string().email('Ingresa un correo válido.'),
  phone: z.string().trim().min(8, 'Ingresa un teléfono de contacto.'),
  taxId: z.string().trim().max(40).optional(),
  storeUrl: z.string().trim().max(200).optional(),
  region: z.string().optional(),
  country: z.string().trim().max(60).optional(),
  athletes: z.coerce.number().int().min(1, 'Indica cuántas unidades.').max(100000).optional(),
  interest: z.string().optional(),
  message: z.string().max(1500).optional(),
  website: z.string().max(0).optional(),
});

/** Cotización de una tienda que compra por mayor para revender. */
export async function submitWholesaleQuote(
  _prev: QuoteState | null,
  formData: FormData,
): Promise<QuoteState> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(`quote:${ip}`, 4, 300_000)) {
    return { ok: false, message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' };
  }
  const raw = Object.fromEntries(formData) as Record<string, string>;
  if (raw.website) return { ok: true, message: 'Recibimos tu solicitud.' };
  if (raw.athletes === '') delete raw.athletes;

  const parsed = storeSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors };
  }

  const d = parsed.data;
  const store = await getStore();
  await prisma.quoteRequest.create({
    data: {
      kind: 'STORE',
      storefront: store,
      clubName: d.clubName,
      contactName: d.contactName,
      email: d.email.toLowerCase().trim(),
      phone: d.phone,
      taxId: d.taxId || null,
      storeUrl: d.storeUrl || null,
      region: d.region || null,
      country: d.country || null,
      athletes: d.athletes ?? null,
      interest: d.interest || null,
      message: d.message?.trim() ?? '',
    },
  });

  await sendQuoteRequestAlert({
    kind: 'STORE',
    clubName: d.clubName,
    contactName: d.contactName,
    email: d.email,
    phone: d.phone,
    athletes: d.athletes,
    message: [d.storeUrl, d.taxId, d.country, d.message].filter(Boolean).join('\n'),
  }).catch(() => {});

  return {
    ok: true,
    message:
      store === 'INTL'
        ? 'Recibimos tu solicitud. Te enviamos la lista de precios mayoristas en menos de 48 horas hábiles.'
        : 'Recibimos tu solicitud. Te enviamos la lista de precios mayoristas en menos de 24 horas hábiles.',
  };
}

export async function submitQuote(_prev: QuoteState | null, formData: FormData): Promise<QuoteState> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(`quote:${ip}`, 4, 300_000)) {
    return { ok: false, message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  if (raw.website) {
    return { ok: true, message: 'Recibimos tu solicitud.' };
  }
  if (raw.athletes === '') delete raw.athletes;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors };
  }

  const data = parsed.data;
  await prisma.quoteRequest.create({
    data: {
      clubName: data.clubName.trim(),
      contactName: data.contactName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
      region: data.region || null,
      athletes: data.athletes ?? null,
      interest: data.interest || null,
      message: data.message?.trim() ?? '',
    },
  });

  await sendQuoteRequestAlert({
    clubName: data.clubName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    athletes: data.athletes,
    message: data.message ?? '',
  }).catch(() => {});

  return {
    ok: true,
    message: 'Recibimos tu solicitud. Te respondemos con la cotización dentro de 24 horas hábiles.',
  };
}
