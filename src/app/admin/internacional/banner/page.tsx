import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { IntlBannerEditor } from '@/components/admin/IntlBannerEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Banner taupoc.lat', noIndex: true });

export default async function IntlBannerPage() {
  await requireAdmin();
  const banners = await prisma.intlBanner.findMany({ orderBy: { position: 'asc' } });
  return (
    <>
      <PageHeader title="Banner de taupoc.lat" description="Lo primero que se ve en la portada internacional. Con más de un banner se muestran como carrusel. Mira cómo queda en escritorio y en teléfono antes de guardar." />
      <IntlBannerEditor banners={banners} />
    </>
  );
}
