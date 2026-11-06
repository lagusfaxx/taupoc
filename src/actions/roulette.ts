'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { getStore } from '@/lib/storefront-server';
import { storeSiteUrl } from '@/lib/storefront';
import { pickPrize, roulettePrizes } from '@/lib/roulette';
import { sendMail } from '@/lib/mail';

export interface SpinResult {
  ok: boolean;
  message?: string;
  /** Índice del segmento donde se detiene la rueda. */
  index?: number;
  label?: string;
  code?: string;
  endsAt?: string;
  /** El correo ya había girado: se le devuelve su mismo cupón. */
  repeated?: boolean;
}

const schema = z.object({ email: z.string().trim().toLowerCase().email('Ingresa un correo válido.') });

function newCode(): string {
  // Sin 0/O ni 1/I: el código se dicta y se copia a mano.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return 'GIRO-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' });
}

export async function spinRoulette(formData: FormData): Promise<SpinResult> {
  const settings = await getSettings();
  if (!settings.rouletteEnabled) return { ok: false, message: 'La ruleta no está disponible.' };

  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  if (formData.get('website')) return { ok: false, message: 'No se pudo girar.' };

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(`ruleta:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Prueba en unos minutos.' };
  }

  const store = await getStore();
  const prizes = roulettePrizes(store);
  const email = parsed.data.email;

  const previous = await prisma.rouletteSpin.findUnique({ where: { email } });
  if (previous) {
    const coupon = await prisma.coupon.findUnique({ where: { code: previous.couponCode } });
    const index = Math.max(0, prizes.findIndex((p) => p.label === previous.prize));
    return {
      ok: true,
      repeated: true,
      index,
      label: previous.prize,
      code: previous.couponCode,
      endsAt: coupon?.endsAt?.toISOString(),
      message:
        coupon && coupon.usedCount > 0
          ? 'Este correo ya giró y su cupón ya se usó.'
          : 'Este correo ya giró. Tu cupón sigue siendo este.',
    };
  }

  const prize = pickPrize(store);
  const endsAt = new Date(Date.now() + settings.rouletteCouponDays * 86_400_000);

  let code = newCode();
  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 3 && (await tx.coupon.findUnique({ where: { code } })); i++) code = newCode();
      await tx.coupon.create({
        data: {
          code,
          description: `Ruleta · ${email}`,
          type: prize.type,
          value: prize.value,
          maxUses: 1,
          perUserLimit: 1,
          endsAt,
        },
      });
      await tx.rouletteSpin.create({
        data: { email, prize: prize.label, couponCode: code, storefront: store },
      });
      await tx.newsletterSubscriber.upsert({
        where: { email },
        create: { email, source: store === 'INTL' ? 'ruleta-lat' : 'ruleta' },
        update: {},
      });
    });
  } catch {
    // Dos giros simultáneos con el mismo correo: gana el primero.
    return { ok: false, message: 'No se pudo girar. Inténtalo de nuevo.' };
  }

  const site = storeSiteUrl(store);
  const until = formatDate(endsAt);
  const accent = store === 'INTL' ? '#1A3CFF' : '#00B894';
  await sendMail({
    to: email,
    subject: `Tu cupón TAUPOC: ${prize.label}`,
    text:
      `Ganaste ${prize.label}.\n\nTu código: ${code}\n` +
      `Úsalo en el carrito antes del ${until}. Un solo uso.\n\n${site}/catalogo`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#111214;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px 32px 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#55585E;">TAUPOC</td></tr>
<tr><td style="padding:0 32px;font-size:28px;font-weight:bold;">Ganaste ${prize.label}</td></tr>
<tr><td style="padding:24px 32px;">
<div style="border:2px dashed ${accent};padding:18px;text-align:center;font-size:26px;font-weight:bold;letter-spacing:3px;">${code}</div>
</td></tr>
<tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.6;color:#55585E;">Escríbelo en el carrito antes del ${until}. Es de un solo uso.</td></tr>
<tr><td style="padding:0 32px 32px;"><a href="${site}/catalogo" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;padding:14px 24px;font-size:14px;font-weight:bold;">Ver trajes</a></td></tr>
</table></td></tr></table></body></html>`,
  }).catch(() => {});

  return {
    ok: true,
    index: prizes.findIndex((p) => p.id === prize.id),
    label: prize.label,
    code,
    endsAt: endsAt.toISOString(),
  };
}
