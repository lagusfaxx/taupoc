import type { Metadata } from 'next';
import Link from 'next/link';
import type { MovementType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({
  title: 'Panel — Historial de stock',
  noIndex: true,
});
const PER_PAGE = 30;
const LABELS: Record<MovementType, string> = {
  RESTOCK: 'Entrada de stock',
  ADJUST: 'Ajuste de stock',
  SALE: 'Venta',
  CANCEL: 'Pedido cancelado',
  RETURN: 'Devolución',
};

export default async function InventoryHistory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '';
  const query = one('q').trim();
  const productId = one('producto');
  const type = one('tipo');
  const where: Prisma.InventoryMovementWhereInput = {
    ...(productId ? { variant: { productId } } : {}),
    ...(Object.hasOwn(LABELS, type) ? { type: type as MovementType } : {}),
    ...(query
      ? {
          OR: [
            { reason: { contains: query, mode: 'insensitive' } },
            { actorEmail: { contains: query, mode: 'insensitive' } },
            {
              variant: {
                OR: [
                  { sku: { contains: query, mode: 'insensitive' } },
                  { product: { name: { contains: query, mode: 'insensitive' } } },
                ],
              },
            },
          ],
        }
      : {}),
  };
  const [total, products] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const page = Math.min(
    Math.max(1, Math.floor(Number(one('pagina')) || 1)),
    Math.max(1, Math.ceil(total / PER_PAGE)),
  );
  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      variant: {
        include: { product: { select: { name: true } }, color: { select: { name: true } } },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });
  const date = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  });
  // Un pedido puede haber sido eliminado; no ofrecer enlaces que ya no existen.
  const orders = await prisma.order.findMany({
    where: { id: { in: movements.flatMap((m) => (m.orderId ? [m.orderId] : [])) } },
    select: { id: true, number: true },
  });
  const orderNumbers = new Map(orders.map((o) => [o.id, o.number]));
  const exportQuery = new URLSearchParams({
    ...(productId ? { producto: productId } : {}),
    ...(query ? { q: query } : {}),
    ...(type ? { tipo: type } : {}),
  });

  return (
    <>
      <PageHeader
        title="Historial de stock"
        description="Entradas, salidas y ventas, con la fecha y la persona que registró cada cambio."
        back={{ href: '/admin/inventario', label: 'Inventario' }}
        actions={
          <ButtonLink
            href={`/api/admin/export/movimientos?${exportQuery}`}
            variant="outline"
            size="sm"
            prefetch={false}
          >
            Exportar historial
          </ButtonLink>
        }
      />
      <Toolbar
        quiet
        searchPlaceholder="Buscar producto, nota o responsable…"
        filters={[
          {
            name: 'producto',
            label: 'Todos los productos',
            options: products.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            name: 'tipo',
            label: 'Todos los movimientos',
            options: Object.entries(LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-ink-900">
        {movements.map((m) => (
          <article
            key={m.id}
            className="flex flex-wrap items-start gap-4 border-b border-line p-5 last:border-0 sm:p-6"
          >
            <div
              className={cn(
                'flex h-12 min-w-14 shrink-0 items-center justify-center px-2 text-lg font-medium tabular-nums',
                'text-chalk-dim',
              )}
            >
              {m.delta > 0 ? '+' : ''}
              {m.delta}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold normal-case tracking-normal">
                {m.variant.product.name}
              </h2>
              <p className="mt-1 text-sm text-chalk-dim">
                {m.variant.color.name} · Talla {m.variant.size}
              </p>
              <p className="mt-2 text-xs text-chalk-faint">
                {LABELS[m.type]} · {m.resulting - m.delta} →{' '}
                <span className="text-chalk">{m.resulting} unidades</span>
              </p>
              {m.reason ? (
                <p className="mt-2 break-words text-sm text-chalk-dim">{m.reason}</p>
              ) : null}
              {m.orderId && orderNumbers.has(m.orderId) ? (
                <Link
                  href={`/admin/pedidos/${m.orderId}`}
                  className="mt-2 inline-block text-xs accent-text"
                >
                  Ver pedido {orderNumbers.get(m.orderId)}
                </Link>
              ) : null}
            </div>
            <div className="w-full text-xs text-chalk-faint sm:w-auto sm:text-right">
              <time dateTime={m.createdAt.toISOString()}>{date.format(m.createdAt)}</time>
              <p className="mt-1 break-all">
                {m.actorEmail || (m.orderId ? 'Venta o actualización del pedido' : 'Sistema')}
              </p>
              <p className="mt-2 break-all text-chalk-faint/70">{m.variant.sku}</p>
            </div>
          </article>
        ))}
        {!movements.length ? (
          <p className="p-12 text-center text-sm text-chalk-faint">
            Todavía no hay movimientos que coincidan con estos filtros.
          </p>
        ) : null}
      </div>
      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} total={total} />
    </>
  );
}
