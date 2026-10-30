import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { getCurrentFx } from '@/lib/fx-server';
import { ROUNDING_LABEL } from '@/lib/fx';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { ExchangeRateForm } from '@/components/admin/ExchangeRateForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Internacional', noIndex: true });

export default async function AdminInternationalPage() {
  await requireAdmin();
  const [current, history, products] = await Promise.all([
    getCurrentFx(),
    prisma.exchangeRate.findMany({ orderBy: { effectiveFrom: 'desc' }, take: 12 }),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, basePrice: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Tienda internacional"
        description="taupoc.lat: mismo catálogo e inventario que taupoc.cl, con precios en dólares calculados desde el precio chileno."
      />

      <ExchangeRateForm
        current={current}
        products={products.map((p) => ({ id: p.id, name: p.name, clp: p.basePrice }))}
      />

      <div className="mt-5">
        <Card title="Historial" description="Cada cambio queda registrado; los precios usan siempre el más reciente.">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-chalk-faint">
                <th className="pb-2 font-normal">Desde</th>
                <th className="pb-2 text-right font-normal">Pesos por dólar</th>
                <th className="pb-2 text-right font-normal">Margen</th>
                <th className="pb-2 text-right font-normal">IVA</th>
                <th className="pb-2 pl-4 font-normal">Redondeo</th>
                <th className="pb-2 pl-4 font-normal">Por</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-t border-line-soft text-chalk-dim">
                  <td className="py-2.5">
                    {r.effectiveFrom.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })}
                    {r.id === current?.id ? <span className="ml-2 text-signal-ok">vigente</span> : null}
                  </td>
                  <td className="py-2.5 text-right">{Number(r.clpPerUsd).toLocaleString('es-CL')}</td>
                  <td className="py-2.5 text-right">{Number(r.marginPct)} %</td>
                  <td className="py-2.5 text-right">{Number(r.vatPct)} %</td>
                  <td className="py-2.5 pl-4">{ROUNDING_LABEL[r.rounding]}</td>
                  <td className="py-2.5 pl-4">{r.createdBy ?? '—'}{r.note ? ` · ${r.note}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
