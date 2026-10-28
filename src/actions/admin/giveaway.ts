'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { saveGiveaway } from '@/lib/giveaway-store';
import { chileLocalToIso, normalizeUser, parseEntries } from '@/lib/giveaway';
import type { AdminState } from './products';

const schema = z.object({
  title: z.string().trim().min(2, 'Ponle un título al sorteo.').max(120),
  prize: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  entriesText: z.string().max(500_000, 'La lista es demasiado larga.').optional(),
  winner: z.string().trim().max(60).optional(),
  active: z.string().optional(),
  showBanner: z.string().optional(),
  revealAt: z.string().trim().optional(),
});

export async function updateGiveaway(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;
  const entriesText = d.entriesText ?? '';
  const winner = (d.winner ?? '').replace(/^@+/, '');
  const active = d.active === 'on';
  const entries = parseEntries(entriesText);

  if (active && entries.length === 0) {
    return { ok: false, message: 'Pega la lista de participantes antes de publicar el sorteo.' };
  }
  if (active && !winner) {
    return { ok: false, message: 'Indica el usuario ganador antes de publicar el sorteo.' };
  }
  if (winner && !entries.some((e) => normalizeUser(e.user) === normalizeUser(winner))) {
    return { ok: false, message: `@${winner} no está en la lista de participantes. Revisa cómo está escrito.` };
  }

  const revealAt = d.revealAt ? chileLocalToIso(d.revealAt) : '';
  if (revealAt === null) return { ok: false, message: 'La fecha y hora de revelación no es válida.' };

  await saveGiveaway({
    active,
    showBanner: d.showBanner === 'on',
    title: d.title,
    prize: d.prize ?? '',
    description: d.description ?? '',
    entriesText,
    winner,
    revealAt,
  });
  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: active
      ? `Sorteo publicado en /sorteo con ${entries.length} comentarios.`
      : 'Sorteo guardado. Aún no está publicado.',
  };
}
