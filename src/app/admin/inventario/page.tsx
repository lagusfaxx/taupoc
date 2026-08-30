import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { Table, Th } from '@/components/admin/Table';
import { StatCard } from '@/components/admin/Card';
import { InventoryRow } from '@/components/admin/InventoryRow';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Inventario', noIndex: true });

const PER_PAGE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;

  const page = Math.max(1, Number(one('pagina') ?? 1) || 1);
  const query = one('q')?.trim();
  const filter = one('filtro');
  const productId = one('producto');

  const settings = await getSettings();

  const where: Prisma.VariantWhereInput = {
    ...(query
      ? {
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { product: { name: { contains: query, mode: 'insensitive' } } },
            { color: { name: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(productId ? { productId } : {}),
    ...(filter === 'agotado' ? { stock: 0 } : {}),
    ...(filter === 'bajo' ? { stock: { gt: 0, lte: settings.lowStockThreshold } } : {}),
    ...(filter === 'inactivo' ? { active: false } : {}),
  };

  const [variants, total, products, aggregates, outOfStock] = await Promise.all([
    prisma.variant.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        color: { select: { name: true, hex: true } },
      },
      orderBy: [{ stock: 'asc' }, { product: { name: 'asc' } }, { size: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.variant.count({ where }),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'DRAFT', 'COMING_SOON'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.variant.aggregate({ where: { active: true }, _sum: { stock: true }, _count: true }),
    prisma.variant.count({ where: { active: true, stock: 0 } }),
  ]);

  const lowStockCount = await prisma.variant.count({
    where: { active: true, stock: { gt: 0, lte: settings.lowStockThreshold } },
  });

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Ajusta el stock de cualquier SKU sin salir de esta pantalla. Para editar un producto completo usa la matriz talla × color."
        actions={
          <ButtonLink href="/api/admin/export/inventario" variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unidades en stock" value={String(aggregates._sum.stock ?? 0)} tone="accent" />
        <StatCard label="SKU activos" value={String(aggregates._count)} />
        <StatCard label="Agotados" value={String(outOfStock)} tone={outOfStock > 0 ? 'bad' : 'ok'} />
        <StatCard
          label="Stock bajo"
          value={String(lowStockCount)}
          hint={`Umbral general: ${settings.lowStockThreshold} unidades`}
          tone={lowStockCount > 0 ? 'warn' : 'ok'}
        />
      </div>

      <Toolbar
        searchPlaceholder="Buscar por SKU, producto o color…"
        filters={[
          {
            name: 'filtro',
            label: 'Todos los SKU',
            options: [
              { value: 'agotado', label: 'Agotados' },
              { value: 'bajo', label: 'Stock bajo' },
              { value: 'inactivo', label: 'Desactivados' },
            ],
          },
          {
            name: 'producto',
            label: 'Todos los productos',
            options: products.map((p) => ({ value: p.id, label: p.name })),
          },
        ]}
      />

      <div className="border border-line bg-ink-900">
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th>Producto / SKU</Th>
              <Th>Color</Th>
              <Th align="center">Talla</Th>
              <Th align="center">Stock</Th>
              <Th align="center">Umbral</Th>
              <Th align="right">Ajustar</Th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <InventoryRow
                key={variant.id}
                row={{
                  variantId: variant.id,
                  sku: variant.sku,
                  productId: variant.product.id,
                  productName: variant.product.name,
                  colorName: variant.color.name,
                  colorHex: variant.color.hex,
                  size: variant.size,
                  stock: variant.stock,
                  threshold: variant.lowStockThreshold || settings.lowStockThreshold,
                  active: variant.active,
                }}
              />
            ))}
            {variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13.5px] text-chalk-faint">
                  No hay SKU que coincidan con la búsqueda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>

      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />
    </>
  );
}
