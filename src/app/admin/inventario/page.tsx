import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { ProductStock } from '@/components/admin/ProductStock';
import { ButtonLink } from '@/components/ui/Button';
import { IconBox, IconDownload, IconPlus } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Inventario', noIndex: true });
const PER_PAGE = 12;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '';
  const requestedPage = Math.max(1, Math.floor(Number(one('pagina')) || 1));
  const query = one('q').trim();
  const filter = one('filtro');
  const productId = one('producto');
  const settings = await getSettings();
  const low: Prisma.VariantWhereInput = {
    stock: { gt: 0 },
    OR: [
      { lowStockThreshold: { gt: 0 }, stock: { lte: prisma.variant.fields.lowStockThreshold } },
      { lowStockThreshold: 0, stock: { lte: settings.lowStockThreshold } },
    ],
  };
  const where: Prisma.ProductWhereInput = {
    ...(productId ? { id: productId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { modelCode: { contains: query, mode: 'insensitive' } },
            {
              variants: {
                some: {
                  OR: [
                    { sku: { contains: query, mode: 'insensitive' } },
                    { size: { equals: query, mode: 'insensitive' } },
                    { color: { name: { contains: query, mode: 'insensitive' } } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
    ...(filter === 'agotado' ? { variants: { some: { stock: { lte: 0 } } } } : {}),
    ...(filter === 'bajo' ? { variants: { some: low } } : {}),
    ...(filter === 'inactivo'
      ? {
          AND: [
            {
              OR: [
                { status: { in: ['DRAFT', 'ARCHIVED'] } },
                { variants: { some: { OR: [{ active: false }, { color: { active: false } }] } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [total, productOptions, totals, empty, lowCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.variant.aggregate({ where: { stock: { gt: 0 } }, _sum: { stock: true } }),
    prisma.variant.count({ where: { stock: { lte: 0 } } }),
    prisma.variant.count({ where: low }),
  ]);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / PER_PAGE)));
  const products = await prisma.product.findMany({
    where,
    include: {
      colors: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, hex: true, active: true },
      },
      variants: { orderBy: [{ sortOrder: 'asc' }, { size: 'asc' }] },
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Encuentra el producto y agrega o quita unidades por talla y color."
        actions={
          <>
            <ButtonLink
              href="/admin/inventario/historial"
              variant="ghost"
              size="sm"
              className="!normal-case !tracking-normal"
            >
              Historial
            </ButtonLink>
            <ButtonLink
              href="/api/admin/export/inventario"
              variant="ghost"
              size="sm"
              prefetch={false}
              className="!normal-case !tracking-normal"
            >
              <IconDownload className="h-4 w-4" /> Exportar
            </ButtonLink>
            <ButtonLink
              href="/admin/productos/nuevo"
              size="sm"
              variant="ghost"
              className="!normal-case !tracking-normal"
            >
              <IconPlus className="h-4 w-4" /> Nuevo producto
            </ButtonLink>
          </>
        }
      />
      <div className="overflow-hidden rounded-xl border border-line bg-ink-900">
        <div className="px-5 pt-5 sm:px-6">
          <dl className="mb-5 flex flex-wrap gap-x-7 gap-y-3 text-sm">
            {[
              {
                label: 'unidades en stock',
                value: totals._sum.stock ?? 0,
                hint: 'Incluye stock de productos ocultos',
              },
              {
                label: 'sin stock',
                value: empty,
                hint: 'Combinaciones de talla y color sin stock o por reponer',
              },
              {
                label: 'con stock bajo',
                value: lowCount,
                hint: 'Combinaciones de talla y color con stock bajo',
              },
            ].map((stat) => (
              <div key={stat.label} title={stat.hint} className="flex items-baseline gap-2">
                <dt className="order-2 text-chalk-faint">{stat.label}</dt>
                <dd className="text-base font-medium tabular-nums text-chalk-dim">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <Toolbar
            quiet
            searchPlaceholder="Buscar producto, color, talla o código…"
            filters={[
              {
                name: 'filtro',
                label: 'Todo el stock',
                options: [
                  { value: 'agotado', label: 'Sin stock o por reponer' },
                  { value: 'bajo', label: 'Stock bajo' },
                  { value: 'inactivo', label: 'Productos o tallas ocultas' },
                ],
              },
              {
                name: 'producto',
                label: 'Todos los productos',
                options: productOptions.map((p) => ({ value: p.id, label: p.name })),
              },
            ]}
          />
          <p className="mb-4 text-xs text-chalk-faint">
            {total} {total === 1 ? 'producto' : 'productos'}
            {filter ? ' con tallas que coinciden con el filtro' : ''}
          </p>
        </div>
        <div className="divide-y divide-line border-t border-line">
          {products.map((product) => (
            <ProductStock
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                modelCode: product.modelCode,
                status: product.status,
                imageUrl: product.images[0]?.url ?? null,
                colors: product.colors,
                variants: product.variants.map((v) => ({
                  id: v.id,
                  colorId: v.colorId,
                  size: v.size,
                  sku: v.sku,
                  stock: v.stock,
                  reserved: v.reserved,
                  active: v.active,
                  lowStockThreshold: v.lowStockThreshold || settings.lowStockThreshold,
                })),
              }}
            />
          ))}
          {!products.length ? (
            <div className="py-14 text-center">
              <IconBox className="mx-auto mb-3 h-9 w-9 text-chalk-faint" />
              <h2 className="text-base normal-case">No encontramos productos</h2>
              <p className="mt-2 text-sm text-chalk-faint">
                Prueba otro nombre o limpia los filtros.
              </p>
              <ButtonLink href="/admin/inventario" variant="ghost" size="sm" className="mt-4">
                Limpiar filtros
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </div>
      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />
    </>
  );
}
