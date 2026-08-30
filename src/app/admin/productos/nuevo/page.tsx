import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Nuevo producto', noIndex: true });

export default async function NewProductPage() {
  await requireAdmin();
  const [lines, categories] = await Promise.all([
    prisma.productLine.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Nuevo producto"
        description="Primero los datos generales. Después vas a poder cargar colores, tallas, stock e imágenes."
        back={{ href: '/admin/productos', label: 'Productos' }}
      />
      <ProductForm
        lines={lines}
        categories={categories}
        product={{
          name: '', slug: '', modelCode: '', subtitle: '', description: '',
          status: 'DRAFT', gender: 'MALE', lineId: '', categoryId: '',
          approvalCode: '', approvalBody: 'World Aquatics', approvalYear: '', approvalVerifyUrl: 'https://www.worldaquatics.com/swimming/approved-swimwear',
          basePrice: '', compareAtPrice: '', weightGrams: '180',
          composition: '', construction: '', finish: '', countryOrigin: '',
          careNotes: '', fitNotes: '', fitOffset: '1',
          featured: false, sortOrder: '0', seoTitle: '', seoDescription: '',
        }}
      />
    </>
  );
}
