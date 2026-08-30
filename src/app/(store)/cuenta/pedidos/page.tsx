import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
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
export const metadata: Metadata = buildMetadata({ title: 'Mis pedidos', path: '/cuenta/pedidos', noIndex: true });

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <Empty
        icon={<IconBox className="h-9 w-9" />}
        title="Todavía no tienes pedidos"
        description="Cuando compres, acá vas a poder seguir el estado y el despacho de cada uno."
        action={<ButtonLink href="/catalogo">Ver catálogo</ButtonLink>}
      />
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id} className="surface">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-5 py-4">
            <div>
              <p className="font-display text-[15px] font-semibold tracking-tight text-chalk">{order.number}</p>
              <p className="mt-0.5 text-[12.5px] text-chalk-faint">{formatDate(order.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
              <span className="font-display text-[16px] font-semibold text-chalk">{formatCLP(order.total)}</span>
              <Link
                href={`/cuenta/pedidos/${order.number}`}
                className="font-display text-[11px] font-semibold uppercase tracking-widest accent-text hover:underline"
              >
                Ver detalle
              </Link>
            </div>
          </div>

          <ul className="flex flex-wrap gap-3 px-5 py-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                {item.imageUrl ? (
                  <span className="relative h-14 w-11 shrink-0 overflow-hidden border border-line bg-ink-800">
                    <Image src={item.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                ) : null}
                <span className="text-[13px]">
                  <span className="block text-chalk">{item.productName}</span>
                  <span className="block text-chalk-faint">
                    {item.colorName} · T{item.size} · {item.quantity} u.
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {order.trackingNumber ? (
            <p className="border-t border-line px-5 py-3 text-[13px] text-chalk-dim">
              Seguimiento {order.shippingCarrier}:{' '}
              <span className="font-mono accent-text">{order.trackingNumber}</span>
              {order.trackingUrl ? (
                <>
                  {' · '}
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    Rastrear
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
