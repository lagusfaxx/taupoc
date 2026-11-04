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
            <ButtonLink href="/admin/inventario/historial" variant="outline" size="sm">
              Historial
            </ButtonLink>
            <ButtonLink
              href="/api/admin/export/inventario"
              variant="outline"
              size="sm"
              prefetch={false}
            >
              <IconDownload className="h-4 w-4" /> Exportar
            </ButtonLink>
            <ButtonLink href="/admin/productos/nuevo" size="sm">
              <IconPlus className="h-4 w-4" /> Nuevo producto
            </ButtonLink>
          </>
        }
      />
      <div className="mb-7 grid grid-cols-3 gap-2 sm:gap-4">
        {[
          {
            label: 'Unidades en stock',
            value: totals._sum.stock ?? 0,
            hint: 'Incluye stock de productos ocultos',
            color: 'accent-text',
          },
          {
            label: 'Sin stock',
            value: empty,
            hint: 'Combinaciones de talla y color',
            color: 'text-signal-bad',
          },
          {
            label: 'Stock bajo',
            value: lowCount,
            hint: 'Tallas y colores por reponer',
            color: 'text-signal-warn',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-ink-900 p-3 sm:p-5">
            <p className="text-xs text-chalk-dim sm:text-sm">{stat.label}</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${stat.color}`}>
              {stat.value}
            </p>
            <p className="mt-2 hidden text-xs text-chalk-faint sm:block">{stat.hint}</p>
          </div>
        ))}
      </div>
      <Toolbar
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
      <p className="mb-4 text-sm text-chalk-faint">
        {total} {total === 1 ? 'producto' : 'productos'}
        {filter ? ' con tallas que coinciden con el filtro' : ''}
      </p>
      <div className="space-y-5">
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
          <div className="rounded-2xl border border-dashed border-line-bright py-14 text-center">
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
      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />
    </>
  );
}
