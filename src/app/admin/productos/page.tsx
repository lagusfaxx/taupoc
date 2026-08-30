import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { buildMetadata } from '@/lib/seo';
import { GENDER_LABEL } from '@/lib/catalog';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProductRowActions } from '@/components/admin/ProductRowActions';
import { IconPlus, IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Productos', noIndex: true });

const PER_PAGE = 20;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  COMING_SOON: 'Próximamente',
  ARCHIVED: 'Archivado',
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'muted' | 'info'> = {
  DRAFT: 'muted',
  ACTIVE: 'ok',
  COMING_SOON: 'info',
  ARCHIVED: 'warn',
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;

  const page = Math.max(1, Number(one('pagina') ?? 1) || 1);
  const query = one('q')?.trim();
  const status = one('estado');
  const gender = one('genero');

  const where: Prisma.ProductWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { modelCode: { contains: query, mode: 'insensitive' } },
            { approvalCode: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(gender ? { gender: gender as never } : {}),
  };

  const [products, total, lines] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        line: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        colors: { select: { id: true, hex: true, name: true } },
        variants: { select: { stock: true, reserved: true, active: true } },
        _count: { select: { variants: true } },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.productLine.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${total} productos en el catálogo · ${lines} líneas configuradas`}
        actions={
          <>
            <ButtonLink href="/api/admin/export/productos" variant="outline" size="sm" prefetch={false}>
              <IconDownload className="h-4 w-4" />
              Exportar CSV
            </ButtonLink>
            <ButtonLink href="/admin/productos/nuevo" size="sm">
              <IconPlus className="h-4 w-4" />
              Nuevo producto
            </ButtonLink>
          </>
        }
      />

      <Toolbar
        searchPlaceholder="Buscar por nombre, modelo o código de homologación…"
        filters={[
          {
            name: 'estado',
            label: 'Todos los estados',
            options: [
              { value: 'ACTIVE', label: 'Activo' },
              { value: 'DRAFT', label: 'Borrador' },
              { value: 'COMING_SOON', label: 'Próximamente' },
              { value: 'ARCHIVED', label: 'Archivado' },
            ],
          },
          {
            name: 'genero',
            label: 'Todos los géneros',
            options: [
              { value: 'MALE', label: 'Hombre' },
              { value: 'FEMALE', label: 'Mujer' },
              { value: 'UNISEX', label: 'Unisex' },
            ],
          },
        ]}
      />

      <div className="border border-line bg-ink-900">
        <Table minWidth={900}>
          <thead>
            <tr>
              <Th>Producto</Th>
              <Th>Estado</Th>
              <Th>Colores</Th>
              <Th align="center">SKU</Th>
              <Th align="right">Stock</Th>
              <Th align="right">Precio</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stock = product.variants
                .filter((v) => v.active)
                .reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
              return (
                <Tr key={product.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="relative h-14 w-11 shrink-0 overflow-hidden border border-line bg-ink-800">
                        {product.images[0] ? (
                          <Image src={product.images[0].url} alt="" fill sizes="44px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <Link
                          href={`/admin/productos/${product.id}`}
                          className="block truncate font-medium text-chalk hover:accent-text"
                        >
                          {product.name}
                        </Link>
                        <span className="block truncate text-[11.5px] text-chalk-faint">
                          {product.modelCode} · {GENDER_LABEL[product.gender]}
                          {product.line ? ` · ${product.line.name}` : ''}
                        </span>
                        {product.approvalCode ? (
                          <span className="mt-0.5 block font-mono text-[11px] accent-text">
                            {product.approvalCode}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {product.colors.slice(0, 8).map((color) => (
                        <span
                          key={color.id}
                          title={color.name}
                          className="h-4 w-4 border border-line-bright"
                          style={{ background: color.hex }}
                        />
                      ))}
                      {product.colors.length > 8 ? (
                        <span className="text-[11px] text-chalk-faint">+{product.colors.length - 8}</span>
                      ) : null}
                      {product.colors.length === 0 ? (
                        <span className="text-[12px] text-chalk-faint">Sin colores</span>
                      ) : null}
                    </div>
                  </Td>
                  <Td align="center">{product._count.variants}</Td>
                  <Td align="right">
                    <span className={stock === 0 ? 'text-signal-bad' : stock < 20 ? 'text-signal-warn' : 'text-chalk'}>
                      {stock}
                    </span>
                  </Td>
                  <Td align="right" className="font-display font-semibold text-chalk">
                    {formatCLP(product.basePrice)}
                  </Td>
                  <Td align="right">
                    <ProductRowActions
                      id={product.id}
                      slug={product.slug}
                      status={product.status}
                      name={product.name}
                    />
                  </Td>
                </Tr>
              );
            })}
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[13.5px] text-chalk-faint">
                  No hay productos que coincidan con la búsqueda.
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
