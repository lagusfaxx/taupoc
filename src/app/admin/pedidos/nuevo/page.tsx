import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/admin/PageHeader';
import { CreateOrderForm } from '@/components/admin/CreateOrderForm';
export const dynamic = 'force-dynamic';
export default async function NewOrderPage() {
  await requireAdmin();
  const variants = await prisma.variant.findMany({
    include: { product: true, color: true },
    orderBy: [{ product: { name: 'asc' } }, { color: { name: 'asc' } }, { sortOrder: 'asc' }],
  });
  return (
    <>
      <PageHeader title="Crear pedido" back={{ href: '/admin/pedidos', label: 'Pedidos' }} />
      <CreateOrderForm
        creationKey={randomUUID()}
        variants={variants.map((v) => ({
          id: v.id,
          label: `${v.product.name} · ${v.color.name} · Talla ${v.size} · ${v.sku}`,
          price: v.priceOverride ?? v.product.basePrice,
          stock: v.stock - v.reserved,
        }))}
      />
    </>
  );
}
