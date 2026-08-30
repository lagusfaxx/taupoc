import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { Pagination } from '@/components/admin/Pagination';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { StatCard } from '@/components/admin/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Clientes', noIndex: true });

const PER_PAGE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;

  const page = Math.max(1, Number(one('pagina') ?? 1) || 1);
  const query = one('q')?.trim();
  const role = one('rol');

  const where: Prisma.UserWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { clubName: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(role ? { role: role as never } : {}),
  };

  const [users, total, totals, marketing] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { acceptsMarketing: true } }),
  ]);

  // Total comprado por cada cliente listado, en una sola consulta.
  const spendRows = await prisma.order.groupBy({
    by: ['email'],
    where: { paymentStatus: 'APPROVED', email: { in: users.map((u) => u.email) } },
    _sum: { total: true },
    _count: true,
  });
  const spend = new Map(spendRows.map((r) => [r.email, { total: r._sum.total ?? 0, orders: r._count }]));

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cuentas registradas, sus compras y su preferencia de comunicación."
        actions={
          <ButtonLink href="/api/admin/export/clientes" variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Clientes registrados" value={String(totals)} />
        <StatCard label="Aceptan comunicaciones" value={String(marketing)} tone="accent" />
        <StatCard label="En esta búsqueda" value={String(total)} />
      </div>

      <Toolbar
        searchPlaceholder="Buscar por nombre, correo o club…"
        filters={[
          {
            name: 'rol',
            label: 'Todos los roles',
            options: [
              { value: 'CUSTOMER', label: 'Cliente' },
              { value: 'STAFF', label: 'Equipo' },
              { value: 'ADMIN', label: 'Administrador' },
            ],
          },
        ]}
      />

      <div className="border border-line bg-ink-900">
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Club</Th>
              <Th align="center">Pedidos</Th>
              <Th align="right">Total comprado</Th>
              <Th>Registro</Th>
              <Th>Rol</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const stats = spend.get(user.email);
              return (
                <Tr key={user.id}>
                  <Td>
                    <Link href={`/admin/clientes/${user.id}`} className="text-chalk hover:accent-text">
                      {user.name} {user.lastName ?? ''}
                    </Link>
                    <p className="text-[11.5px] text-chalk-faint">{user.email}</p>
                    {user.acceptsMarketing ? (
                      <p className="mt-0.5 text-[11px] accent-text">Acepta comunicaciones</p>
                    ) : null}
                  </Td>
                  <Td>{user.clubName ?? '—'}</Td>
                  <Td align="center">{stats?.orders ?? user._count.orders}</Td>
                  <Td align="right" className="font-display font-semibold text-chalk">
                    {formatCLP(stats?.total ?? 0)}
                  </Td>
                  <Td>{formatDate(user.createdAt)}</Td>
                  <Td>
                    <Badge tone={user.role === 'ADMIN' ? 'accent' : user.role === 'STAFF' ? 'info' : 'muted'}>
                      {user.role === 'ADMIN' ? 'Admin' : user.role === 'STAFF' ? 'Equipo' : 'Cliente'}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13.5px] text-chalk-faint">
                  No hay clientes que coincidan con la búsqueda.
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
