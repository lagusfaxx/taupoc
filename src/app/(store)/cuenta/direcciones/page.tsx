import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { AddressManager } from '@/components/store/AddressManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Mis direcciones', path: '/cuenta/direcciones', noIndex: true });

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div>
      <h2 className="mb-1.5 font-display text-[15px] uppercase tracking-widest text-chalk">Direcciones</h2>
      <p className="mb-6 text-[13px] text-chalk-faint">
        Guarda tus direcciones frecuentes para comprar más rápido.
      </p>
      <AddressManager addresses={addresses} />
    </div>
  );
}
