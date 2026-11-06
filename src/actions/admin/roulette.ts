'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { saveRoulette } from '@/lib/roulette-store';
import type { RouletteConfig } from '@/lib/roulette';
import type { AdminState } from './products';

const prize = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, 'Cada premio necesita un texto.').max(16, 'El texto de un premio no puede pasar de 16 caracteres.'),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  value: z.coerce.number().int().min(0),
  weight: z.coerce.number().min(0).max(1000),
});

const prizes = z.array(prize).max(10, 'Máximo 10 premios por rueda.');

const num = (min: number, max: number, fallback: number) =>
  z.coerce.number().catch(fallback).transform((n) => Math.min(max, Math.max(min, Math.round(n))));

const schema = z.object({
  title: z.string().trim().min(2, 'Escribe el título de la ruleta.').max(60),
  buttonLabel: z.string().trim().min(2, 'Escribe el texto del botón.').max(24),
  couponDays: num(1, 90, 7),
  minSubtotal: num(0, 10_000_000, 0),
  autoOpenSeconds: num(0, 600, 20),
  snoozeDays: num(0, 60, 3),
});

function checkPrizes(list: z.infer<typeof prizes>, store: string): string | null {
  for (const p of list) {
    if (p.type === 'PERCENT' && (p.value < 1 || p.value > 90)) {
      return `${store}: el porcentaje de "${p.label}" debe ir de 1 a 90.`;
    }
    if (p.type === 'FIXED' && p.value < 1) return `${store}: indica el monto de "${p.label}".`;
  }
  return null;
}

export async function updateRoulette(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };

  let cl: z.infer<typeof prizes>;
  let intl: z.infer<typeof prizes>;
  try {
    const a = prizes.safeParse(JSON.parse(String(formData.get('prizesCL') ?? '[]')));
    const b = prizes.safeParse(JSON.parse(String(formData.get('prizesINTL') ?? '[]')));
    if (!a.success) return { ok: false, message: a.error.issues[0]?.message ?? 'Revisa los premios.' };
    if (!b.success) return { ok: false, message: b.error.issues[0]?.message ?? 'Revisa los premios.' };
    cl = a.data;
    intl = b.data;
  } catch {
    return { ok: false, message: 'No se pudieron leer los premios.' };
  }

  const error = checkPrizes(cl, 'taupoc.cl') ?? checkPrizes(intl, 'taupoc.lat');
  if (error) return { ok: false, message: error };

  const enabled = formData.get('enabled') === 'on';
  const showCL = formData.get('showCL') === 'on';
  const showINTL = formData.get('showINTL') === 'on';
  const winnable = (list: typeof cl, lat: boolean) =>
    list.filter((p) => p.weight > 0 && !(lat && p.type === 'FREE_SHIPPING')).length;

  if (enabled && showCL && winnable(cl, false) < 2) {
    return { ok: false, message: 'La rueda de taupoc.cl necesita al menos 2 premios con probabilidad.' };
  }
  if (enabled && showINTL && winnable(intl, true) < 2) {
    return {
      ok: false,
      message: 'La rueda de taupoc.lat necesita al menos 2 premios con probabilidad (el envío gratis no cuenta allá).',
    };
  }

  const config: RouletteConfig = {
    enabled,
    showCL,
    showINTL,
    exitIntent: formData.get('exitIntent') === 'on',
    ...parsed.data,
    prizesCL: cl,
    prizesINTL: intl,
  };
  await saveRoulette(config);
  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: enabled ? 'Ruleta guardada y publicada.' : 'Ruleta guardada. Está apagada: no se muestra en la tienda.',
  };
}
