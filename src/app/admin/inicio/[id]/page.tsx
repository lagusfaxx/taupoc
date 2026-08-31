import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { HomeBlockForm } from '@/components/admin/HomeBlockForm';

export const dynamic = 'force-dynamic';

const NOMBRES: Record<string, string> = {
  BANNER: 'Banner',
  PRODUCTOS: 'Franja de productos',
  CATEGORIAS: 'Accesos',
  MEDIA: 'Imagen o video',
  TEXTO: 'Texto',
};

export default async function EditarBloquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [block, products] = await Promise.all([
    prisma.homeBlock.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    }),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, modelCode: true },
    }),
  ]);

  if (!block) notFound();

  return (
    <>
      <PageHeader
        title={block.label || NOMBRES[block.type] || 'Bloque'}
        description={NOMBRES[block.type]}
        back={{ href: '/admin/inicio', label: 'Inicio' }}
      />

      <HomeBlockForm
        products={products}
        block={{
          id: block.id,
          type: block.type,
          label: block.label,
          active: block.active,
          eyebrow: block.eyebrow,
          title: block.title,
          subtitle: block.subtitle,
          body: block.body,
          ctaLabel: block.ctaLabel,
          ctaHref: block.ctaHref,
          ctaAltLabel: block.ctaAltLabel,
          ctaAltHref: block.ctaAltHref,
          imageUrl: block.imageUrl,
          imageMobileUrl: block.imageMobileUrl,
          videoUrl: block.videoUrl,
          posterUrl: block.posterUrl,
          fit: block.fit,
          overlay: block.overlay,
          height: block.height,
          align: block.align,
          background: block.background,
          columns: block.columns,
          intervalSec: block.intervalSec,
          productIds: block.items.flatMap((item) => (item.productId ? [item.productId] : [])),
          cards: block.items
            .filter((item) => !item.productId)
            .map((item) => ({
              eyebrow: item.eyebrow ?? '',
              label: item.label ?? '',
              caption: item.caption ?? '',
              ctaLabel: item.ctaLabel ?? '',
              href: item.href ?? '',
              imageUrl: item.imageUrl ?? '',
              imageMobileUrl: item.imageMobileUrl ?? '',
              videoUrl: item.videoUrl ?? '',
              posterUrl: item.posterUrl ?? '',
            })),
        }}
      />
    </>
  );
}
