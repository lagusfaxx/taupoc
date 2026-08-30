import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { ShippingManager } from '@/components/admin/ShippingManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Envíos', noIndex: true });

export default async function AdminShippingPage() {
  await requireAdmin();
  const [zones, settings] = await Promise.all([
    prisma.shippingZone.findMany({
      include: { rates: { orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] } },
      orderBy: { sortOrder: 'asc' },
    }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Zonas y tarifas de envío"
        description="Define cuánto cuesta despachar a cada zona del país. Los cambios se aplican de inmediato en el checkout, sin necesidad de publicar nada."
      />

      <div className="mb-6 border-l-2 accent-border bg-ink-900 px-4 py-3.5">
        <p className="text-[13.5px] leading-relaxed text-chalk-dim">
          {settings.freeShippingOver ? (
            <>
              Actualmente el despacho es gratis en compras sobre{' '}
              <strong className="accent-text">{formatCLP(settings.freeShippingOver)}</strong>. Puedes
              cambiar ese umbral general en Ajustes, o definir uno distinto por tarifa.
            </>
          ) : (
            <>
              No hay un umbral general de envío gratis configurado. Puedes definirlo en Ajustes o por
              tarifa individual.
            </>
          )}
        </p>
      </div>

      <ShippingManager
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          regions: zone.regions,
          sortOrder: zone.sortOrder,
          active: zone.active,
          rates: zone.rates.map((rate) => ({
            id: rate.id,
            zoneId: rate.zoneId,
            carrier: rate.carrier,
            label: rate.label,
            description: rate.description,
            mode: rate.mode,
            price: rate.price,
            minWeightG: rate.minWeightG,
            maxWeightG: rate.maxWeightG,
            minSubtotal: rate.minSubtotal,
            maxSubtotal: rate.maxSubtotal,
            freeOverSubtotal: rate.freeOverSubtotal,
            etaMinDays: rate.etaMinDays,
            etaMaxDays: rate.etaMaxDays,
            isPickup: rate.isPickup,
            pickupInfo: rate.pickupInfo,
            active: rate.active,
            sortOrder: rate.sortOrder,
          })),
        }))}
      />
    </>
  );
}
