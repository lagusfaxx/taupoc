import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { CouponManager } from '@/components/admin/CouponManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Cupones', noIndex: true });

export default async function AdminCouponsPage() {
  await requireAdmin();
  const [coupons, products] = await Promise.all([
    prisma.coupon.findMany({
      include: { products: { select: { productId: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Cupones y descuentos"
        description="Porcentaje, monto fijo o envío gratis. Puedes limitarlos por monto mínimo, fechas, cantidad de usos o productos específicos."
      />
      <CouponManager
        products={products}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          type: c.type,
          value: c.value,
          minSubtotal: c.minSubtotal,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          perUserLimit: c.perUserLimit,
          startsAt: c.startsAt ? c.startsAt.toISOString().slice(0, 10) : null,
          endsAt: c.endsAt ? c.endsAt.toISOString().slice(0, 10) : null,
          active: c.active,
          productIds: c.products.map((p) => p.productId),
        }))}
      />
    </>
  );
}
