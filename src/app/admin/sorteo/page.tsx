import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getGiveaway } from '@/lib/giveaway-store';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { GiveawayForm } from '@/components/admin/GiveawayForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Sorteo', noIndex: true });

export default async function AdminGiveawayPage() {
  await requireAdmin();
  const giveaway = await getGiveaway();

  return (
    <>
      <PageHeader
        title="Sorteo"
        description="Publica el ganador de un sorteo de Instagram con todos los comentarios y una animación."
      />
      <GiveawayForm giveaway={giveaway} />
    </>
  );
}
