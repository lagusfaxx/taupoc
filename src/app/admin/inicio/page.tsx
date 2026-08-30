import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { HomeBuilder } from '@/components/admin/HomeBuilder';
import { ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const blocks = await prisma.homeBlock.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      type: true,
      label: true,
      title: true,
      active: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Inicio"
        description="Arma la portada con los bloques que quieras y en el orden que quieras."
        actions={
          <ButtonLink href="/" variant="outline" size="sm" target="_blank">
            Ver la tienda
          </ButtonLink>
        }
      />

      <HomeBuilder
        blocks={blocks.map((block) => ({
          id: block.id,
          type: block.type,
          label: block.label,
          title: block.title,
          active: block.active,
          items: block._count.items,
        }))}
      />
    </>
  );
}
