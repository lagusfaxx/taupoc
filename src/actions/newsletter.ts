'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
  source: z.string().optional(),
});

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function subscribeNewsletter(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    source: formData.get('source'),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }

  const ip = (await headers()).get('x-forwarded-for') ?? 'local';
  if (!rateLimit(`newsletter:${ip}`, 5, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera un momento.' };
  }

  const email = parsed.data.email.toLowerCase().trim();
  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source: parsed.data.source ?? 'footer' },
      update: {},
    });
    return { ok: true, message: 'Listo. Te avisamos de reposiciones y torneos.' };
  } catch {
    return { ok: false, message: 'No pudimos registrarte. Intenta de nuevo.' };
  }
}
