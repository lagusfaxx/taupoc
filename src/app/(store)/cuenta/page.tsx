import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatCLP } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { ORDER_STATUS_LABEL, orderStatusTone } from '@/lib/orders';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { ButtonLink } from '@/components/ui/Button';
import { IconBox } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Mi cuenta', path: '/cuenta', noIndex: true });

export default async function AccountPage() {
  const user = await requireUser();

  const [orders, totals, addressCount] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: { take: 3 } },
    }),
    prisma.order.aggregate({
      where: { OR: [{ userId: user.id }, { email: user.email }], paymentStatus: 'APPROVED' },
      _sum: { total: true },
      _count: true,
    }),
    prisma.address.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-10">
      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        {[
          { label: 'Pedidos pagados', value: String(totals._count) },
          { label: 'Total comprado', value: formatCLP(totals._sum.total ?? 0) },
          { label: 'Direcciones guardadas', value: String(addressCount) },
        ].map((stat) => (
          <div key={stat.label} className="bg-ink-900 p-5">
            <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">{stat.label}</p>
            <p className="mt-2 font-display text-[24px] font-bold tracking-tight text-chalk">{stat.value}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-[15px] uppercase tracking-widest text-chalk">Últimos pedidos</h2>
          <Link href="/cuenta/pedidos" className="font-display text-[11px] uppercase tracking-widest text-chalk-faint hover:accent-text">
            Ver todos
          </Link>
        </div>

        {orders.length === 0 ? (
          <Empty
            icon={<IconBox className="h-9 w-9" />}
            title="Todavía no tienes pedidos"
            description="Cuando compres, acá vas a poder seguir el estado y el despacho de cada uno."
            action={<ButtonLink href="/catalogo">Ver catálogo</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-line border border-line">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/cuenta/pedidos/${order.number}`} className="block px-5 py-4 transition-colors hover:bg-ink-800">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div>
                      <p className="font-display text-[14px] font-semibold tracking-tight text-chalk">
                        {order.number}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-chalk-faint">
                        {formatDate(order.createdAt)} ·{' '}
                        {order.items.map((i) => i.productName).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                      <span className="font-display text-[15px] font-semibold text-chalk">
                        {formatCLP(order.total)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
