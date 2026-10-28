import { NextResponse } from 'next/server';
import { getGiveaway } from '@/lib/giveaway-store';
import { isRevealed, normalizeUser, parseEntries } from '@/lib/giveaway';

export const dynamic = 'force-dynamic';

/**
 * Entrega el ganador recién cuando llega la hora de revelarlo. La cuenta
 * regresiva de /sorteo lo pide al llegar a cero: así el ganador nunca está en
 * la página antes de tiempo, ni siquiera en el código fuente.
 */
export async function GET() {
  const giveaway = await getGiveaway();
  if (!giveaway.active) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!isRevealed(giveaway)) {
    return NextResponse.json(
      { error: 'too_early', revealAt: giveaway.revealAt },
      { status: 425, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const winner = parseEntries(giveaway.entriesText).find(
    (e) => normalizeUser(e.user) === normalizeUser(giveaway.winner),
  );
  if (!winner) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ winner }, { headers: { 'Cache-Control': 'no-store' } });
}
