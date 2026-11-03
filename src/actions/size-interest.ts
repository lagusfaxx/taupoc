'use server';

import { createHash } from 'crypto';
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readCartToken } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { cookieSecure } from '@/lib/cookies';

const VISITOR_COOKIE = 'taupoc_vid';
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
/** Ventana en la que la misma IP y navegador se toman como el mismo visitante. */
const SAME_DEVICE_MS = 1000 * 60 * 60 * 24 * 30;

export interface InterestState {
  ok: boolean;
  message: string;
  /** Falta el correo: la ficha muestra el campo. */
  needEmail?: boolean;
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

  const head = await headers();
  const ip = head.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  // Repetir el clic no suma: 10 por minuto basta para quien recorre varias tallas.
  if (!rateLimit(`interest:${ip}`, 10, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera un momento.' };
  }

  const variant = await prisma.variant.findUnique({
    where: { id: parsed.data.variantId },
    select: { id: true, size: true },
  });
  if (!variant) return { ok: false, message: 'No encontramos esa talla.' };

  const [session, cartToken, store] = await Promise.all([getSession(), readCartToken(), cookies()]);

  // Identificador propio del visitante, de larga duración: no cambia al
  // agregar algo al carrito ni al iniciar sesión.
  let visitorId = store.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    visitorId = randomUUID();
    store.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: await cookieSecure(),
      maxAge: VISITOR_MAX_AGE,
      path: '/',
    });
  }
  const visitorKey = `v:${visitorId}`;
  const fingerprint = createHash('sha256')
    .update(`${ip}|${head.get('user-agent') ?? ''}`)
    .digest('hex')
    .slice(0, 32);
  const correo = parsed.data.email ? parsed.data.email.toLowerCase() : session?.email || null;
  // Sin correo no cuenta: un clic anónimo es fácil de inflar y no sirve para avisar.
  if (!correo) {
    return { ok: false, needEmail: true, message: 'Déjanos tu correo para anotarte.' };
  }

  // Es la misma persona si coincide cualquiera de sus huellas: cookie, carrito,
  // cuenta, correo o la misma IP y navegador en el último mes. Así borrar
  // cookies o abrir incógnito no infla la demanda.
  const existing = await prisma.sizeInterest.findFirst({
    where: {
      variantId: variant.id,
      OR: [
        { visitorKey },
        ...(cartToken ? [{ visitorKey: `c:${cartToken}` }] : []),
        ...(session ? [{ userId: session.id }, { visitorKey: `u:${session.id}` }] : []),
        ...(correo ? [{ email: correo }] : []),
        { fingerprint, createdAt: { gte: new Date(Date.now() - SAME_DEVICE_MS) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    await prisma.sizeInterest.update({
      where: { id: existing.id },
      data: {
        fingerprint,
        ...(correo && !existing.email ? { email: correo } : {}),
        ...(session && !existing.userId ? { userId: session.id } : {}),
      },
    });
  } else {
    await prisma.sizeInterest
      .create({
        data: { variantId: variant.id, visitorKey, fingerprint, email: correo, userId: session?.id ?? null },
      })
      // Dos clics simultáneos: el segundo choca con el índice único y no cuenta.
      .catch(() => null);
  }

  return {
    ok: true,
    message: `Listo. Te avisamos a ${correo} cuando vuelva la talla ${variant.size}.`,
  };
}
