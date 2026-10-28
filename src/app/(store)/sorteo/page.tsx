import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGiveaway } from '@/lib/giveaway-store';
import { isRevealed, normalizeUser, parseEntries, uniqueUsers } from '@/lib/giveaway';
import { buildMetadata } from '@/lib/seo';
import { GiveawayDraw } from '@/components/store/GiveawayDraw';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const giveaway = await getGiveaway();
  // Página de una campaña puntual: se comparte, pero no se indexa.
  return buildMetadata({
    title: `${giveaway.title} · Ganador`,
    description: giveaway.prize
      ? `Mira quién ganó ${giveaway.prize} en el sorteo de TAUPOC Chile en Instagram.`
      : 'Mira quién ganó el sorteo de TAUPOC Chile en Instagram.',
    path: '/sorteo',
    noIndex: true,
  });
}

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default async function GiveawayPage() {
  const giveaway = await getGiveaway();
  if (!giveaway.active) notFound();

  const entries = parseEntries(giveaway.entriesText);
  const winner = entries.find((e) => normalizeUser(e.user) === normalizeUser(giveaway.winner));
  if (!winner) notFound();
  // Antes de la hora el ganador no se manda al navegador: lo pide la cuenta
  // regresiva a /api/sorteo/ganador cuando llega a cero.
  const revealed = isRevealed(giveaway);

  // Liberado el ganador, la lista completa ya no sale del servidor: así nadie
  // puede ir a contar comentarios después. La ruleta solo necesita una
  // muestra al azar para animar.
  const shown = revealed ? sample(entries, 80) : entries;

  return (
    <GiveawayDraw
      title={giveaway.title}
      prize={giveaway.prize}
      description={giveaway.description}
      entries={shown}
      totalComments={entries.length}
      showList={!revealed}
      winner={revealed ? winner : null}
      revealAt={revealed ? null : giveaway.revealAt}
      participants={uniqueUsers(entries).length}
    />
  );
}
