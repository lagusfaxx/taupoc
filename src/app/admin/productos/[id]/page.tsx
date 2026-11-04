import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { formatCLP } from '@/lib/money';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { ProductForm } from '@/components/admin/ProductForm';
import { ProductStock } from '@/components/admin/ProductStock';
import { AddSizeForm } from '@/components/admin/AddSizeForm';
import { getSettings } from '@/lib/settings';
import { ColorManager } from '@/components/admin/ColorManager';
import { ImageManager } from '@/components/admin/ImageManager';
import { SpecsEditor, SizeChartEditor } from '@/components/admin/SpecsEditor';
import { ReviewManager } from '@/components/admin/ReviewManager';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { Badge } from '@/components/ui/Badge';
import { IconExternal } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Editar producto', noIndex: true });

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const search = await searchParams;

  const [product, lines, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        colors: {
          orderBy: { sortOrder: 'asc' },
          include: { variants: { select: { id: true, stock: true, reserved: true } } },
        },
        variants: { orderBy: [{ sortOrder: 'asc' }, { size: 'asc' }] },
        images: { orderBy: { sortOrder: 'asc' } },
        specs: { orderBy: { sortOrder: 'asc' } },
        sizeChart: { orderBy: { sortOrder: 'asc' } },
        reviews: { orderBy: [{ publishedAt: 'desc' }] },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.productLine.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  const settings = await getSettings();

  const colors = product.colors.map((color) => ({
    id: color.id,
    name: color.name,
    code: color.code,
    hex: color.hex,
    accentHex: color.accentHex,
    stripCode: color.stripCode,
    stripHex: color.stripHex,
    active: color.active,
    sortOrder: color.sortOrder,
    variantCount: color.variants.length,
    stock: color.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0),
  }));

  const totalStock = product.variants
    .filter((v) => v.active)
    .reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);

  const created = search.creado === '1';
  const duplicated = search.duplicado === '1';

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.modelCode}${product.approvalCode ? ` · Homologación ${product.approvalCode}` : ''} · ${product.variants.length} SKU · ${totalStock} unidades en stock`}
        back={{ href: '/admin/productos', label: 'Productos' }}
        actions={
          <>
            <Badge tone={product.status === 'ACTIVE' ? 'ok' : product.status === 'DRAFT' ? 'muted' : 'info'}>
              {product.status === 'ACTIVE' ? 'Activo'
                : product.status === 'DRAFT' ? 'Borrador'
                : product.status === 'COMING_SOON' ? 'Próximamente' : 'Archivado'}
            </Badge>
            <Link
              href={`/producto/${product.slug}`}
              target="_blank"
              className="inline-flex h-9 items-center gap-2 border border-line px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
            >
              <IconExternal className="h-3.5 w-3.5" />
              Ver en la tienda
            </Link>
          </>
        }
      />

      {created || duplicated ? (
        <p className="mb-5 border border-signal-ok/40 bg-signal-ok/10 px-4 py-3 text-[13.5px] text-signal-ok">
          {created
            ? 'Producto creado. Ahora carga los colores y luego el stock por talla.'
            : 'Producto duplicado como borrador, sin stock ni código de homologación. Revísalo antes de activarlo.'}
        </p>
      ) : null}

      <AdminTabs
        tabs={[
          {
            id: 'general',
            label: 'General',
            content: <ProductForm product={toFormData(product)} lines={lines} categories={categories} />,
          },
          {
            id: 'colores',
            label: `Colores (${colors.length})`,
            content: (
              <Card
                title="Colores del producto"
                description="Agrega colores o cambia su visibilidad. Las tallas y el stock se conservan al ocultarlos."
              >
                <ColorManager productId={product.id} colors={colors} />
              </Card>
            ),
          },
          {
            id: 'stock',
            label: 'Stock',
            content: (
              <div className="space-y-5">
                <ProductStock defaultOpen product={{
                  id: product.id, name: product.name, modelCode: product.modelCode, status: product.status,
                  imageUrl: product.images[0]?.url ?? null,
                  colors: product.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, active: c.active })),
                  variants: product.variants.map((v) => ({
                    id: v.id, colorId: v.colorId, size: v.size, sku: v.sku, stock: v.stock,
                    reserved: v.reserved, active: v.active,
                    lowStockThreshold: v.lowStockThreshold || settings.lowStockThreshold,
                  })),
                }} />
                {colors.length > 0 ? <AddSizeForm productId={product.id} /> : null}
              </div>
            ),
          },
          {
            id: 'imagenes',
            label: `Imágenes (${product.images.length})`,
            content: (
              <Card title="Imágenes" description="Arrastra y suelta. Asigna cada imagen a un color para que aparezca al seleccionarlo.">
                <ImageManager
                  productId={product.id}
                  images={product.images.map((i) => ({
                    id: i.id, url: i.url, alt: i.alt, colorId: i.colorId, isPrimary: i.isPrimary,
                  }))}
                  colors={colors.map((c) => ({ id: c.id, name: c.name, code: c.code, hex: c.hex }))}
                />
              </Card>
            ),
          },
          // Un accesorio no lleva tabla de tallas: la pestaña sobra.
          ...(product.kind === 'ACCESSORY' ? [] : [{
            id: 'tallas',
            label: 'Tabla de tallas',
            content: (
              <Card title="Tabla de tallas" description="Es lo que ve el cliente al abrir la guía de tallas en la ficha.">
                <SizeChartEditor
                  productId={product.id}
                  rows={product.sizeChart.map((r) => ({
                    size: r.size,
                    chestMinCm: r.chestMinCm, chestMaxCm: r.chestMaxCm,
                    waistMinCm: r.waistMinCm, waistMaxCm: r.waistMaxCm,
                    hipMinCm: r.hipMinCm, hipMaxCm: r.hipMaxCm,
                    heightMinCm: r.heightMinCm, heightMaxCm: r.heightMaxCm,
                    cn: r.cn, usa: r.usa, uk: r.uk, aus: r.aus, nz: r.nz,
                  }))}
                />
              </Card>
            ),
          },
          {
            id: 'opiniones',
            label: `Opiniones (${product.reviews.length})`,
            content: (
              <Card
                title="Opiniones del producto"
                description="Se muestran en la ficha y viajan en el marcado que lee Google."
              >
                <ReviewManager
                  productId={product.id}
                  reviews={product.reviews.map((r) => ({
                    id: r.id,
                    rating: r.rating,
                    title: r.title,
                    body: r.body,
                    authorName: r.authorName,
                    authorNote: r.authorNote,
                    verified: r.verified,
                    status: r.status,
                    publishedAt: r.publishedAt.toISOString().slice(0, 10),
                  }))}
                />
              </Card>
            ),
          }]),
          {
            id: 'ficha',
            label: 'Ficha técnica',
            content: (
              <Card title="Ficha técnica" description="Pares de dato y valor que se muestran en la ficha del producto.">
                <SpecsEditor
                  productId={product.id}
                  specs={product.specs.map((s) => ({ label: s.label, value: s.value }))}
                />
              </Card>
            ),
          },
        ]}
      />

      {product._count.orderItems > 0 ? (
        <p className="mt-6 text-[12px] text-chalk-faint">
          Este producto tiene {product._count.orderItems} líneas de pedido asociadas. Al archivarlo se
          conservan el stock y el historial de ventas. Precio actual:{' '}
          {formatCLP(product.basePrice)}.
        </p>
      ) : null}
    </>
  );
}

function toFormData(product: {
  id: string; name: string; slug: string; modelCode: string; subtitle: string | null;
  description: string; status: string; gender: string; kind: string; lineId: string | null; categoryId: string | null;
  approvalCode: string | null; approvalBody: string; approvalYear: number | null; approvalVerifyUrl: string | null;
  basePrice: number; weightGrams: number;
  composition: string | null; construction: string | null; finish: string | null; countryOrigin: string | null;
  careNotes: string | null; fitNotes: string | null; fitOffset: number; featured: boolean; sortOrder: number;
  seoTitle: string | null; seoDescription: string | null;
}) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    modelCode: product.modelCode,
    subtitle: product.subtitle ?? '',
    description: product.description,
    status: product.status,
    gender: product.gender,
    kind: product.kind,
    lineId: product.lineId ?? '',
    categoryId: product.categoryId ?? '',
    approvalCode: product.approvalCode ?? '',
    approvalBody: product.approvalBody,
    approvalYear: product.approvalYear ? String(product.approvalYear) : '',
    approvalVerifyUrl: product.approvalVerifyUrl ?? '',
    basePrice: String(product.basePrice),
    weightGrams: String(product.weightGrams),
    composition: product.composition ?? '',
    construction: product.construction ?? '',
    finish: product.finish ?? '',
    countryOrigin: product.countryOrigin ?? '',
    careNotes: product.careNotes ?? '',
    fitNotes: product.fitNotes ?? '',
    fitOffset: String(product.fitOffset),
    featured: product.featured,
    sortOrder: String(product.sortOrder),
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
  };
}
