import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { CategoryManager } from '@/components/admin/CategoryManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Categorías', noIndex: true });

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title="Categorías del catálogo"
        description="Las categorías con las que se agrupan los productos. El orden de las filas es el orden en los filtros de la tienda, y cada una se puede enlazar desde el menú."
      />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? '',
          active: c.active,
          products: c._count.products,
        }))}
      />
    </>
  );
}
