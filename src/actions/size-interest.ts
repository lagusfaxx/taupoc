'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readCartToken } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export interface InterestState {
  ok: boolean;
  message: string;
}

const schema = z.object({
  variantId: z.string().min(1),
  email: z.string().trim().email('Ingresa un correo válido.').optional().or(z.literal('')),
});

/**
 * "¿Te interesa esta talla?" sobre una talla agotada o apagada. Cada visitante
 * cuenta una vez por talla; si deja correo después, se completa el registro.
 */
export async function registerSizeInterest(variantId: string, email?: string): Promise<InterestState> {
  const parsed = schema.safeParse({ variantId, email: email ?? '' });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(`interest:${ip}`, 30, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera un momento.' };
  }

  const variant = await prisma.variant.findUnique({
    where: { id: parsed.data.variantId },
    select: { id: true, size: true },
  });
  if (!variant) return { ok: false, message: 'No encontramos esa talla.' };

  const [session, cartToken] = await Promise.all([getSession(), readCartToken()]);
  const visitorKey = session
    ? `u:${session.id}`
    : cartToken
      ? `c:${cartToken}`
      : `ip:${createHash('sha256').update(ip).digest('hex').slice(0, 24)}`;
  const correo = parsed.data.email ? parsed.data.email.toLowerCase() : session?.email || null;

  await prisma.sizeInterest.upsert({
    where: { variantId_visitorKey: { variantId: variant.id, visitorKey } },
    create: { variantId: variant.id, visitorKey, email: correo, userId: session?.id ?? null },
    update: correo ? { email: correo } : {},
  });

  return {
    ok: true,
    message: correo
      ? `Listo. Te avisamos a ${correo} cuando vuelva la talla ${variant.size}.`
      : `Anotado tu interés por la talla ${variant.size}.`,
  };
}
