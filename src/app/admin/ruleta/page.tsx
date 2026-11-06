import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getRoulette } from '@/lib/roulette-store';
import { buildMetadata } from '@/lib/seo';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { RouletteForm } from '@/components/admin/RouletteForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Ruleta', noIndex: true });

export default async function AdminRoulettePage() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [config, total, last30, recent] = await Promise.all([
    getRoulette(),
    prisma.rouletteSpin.count(),
    prisma.rouletteSpin.count({ where: { createdAt: { gte: since } } }),
    prisma.rouletteSpin.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const codes = await prisma.coupon.findMany({
    where: { code: { startsWith: 'GIRO-' } },
    select: { code: true, usedCount: true },
  });
  const used = codes.filter((c) => c.usedCount > 0).length;
  const usedSet = new Set(codes.filter((c) => c.usedCount > 0).map((c) => c.code));

  return (
    <>
      <PageHeader
        title="Ruleta"
        description="Descuento a cambio del correo. Actívala, elige dónde aparece y define los premios."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Estado" value={config.enabled ? 'Activa' : 'Apagada'} tone={config.enabled ? 'ok' : 'warn'} />
        <StatCard label="Correos captados" value={String(total)} hint={`${last30} en los últimos 30 días`} tone="accent" />
        <StatCard
          label="Cupones usados"
          value={String(used)}
          hint={total ? `${Math.round((used / total) * 100)}% de los giros` : undefined}
          tone="ok"
        />
      </div>

      <RouletteForm config={config} />

      <Card title="Últimos giros" className="mt-6" padded={false}>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-chalk-faint">Todavía nadie ha girado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
                  <th className="border-b border-line px-5 py-3">Correo</th>
                  <th className="border-b border-line px-5 py-3">Premio</th>
                  <th className="border-b border-line px-5 py-3">Cupón</th>
                  <th className="border-b border-line px-5 py-3">Tienda</th>
                  <th className="border-b border-line px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="border-b border-line-soft px-5 py-3 text-chalk">{s.email}</td>
                    <td className="border-b border-line-soft px-5 py-3 text-chalk-dim">{s.prize}</td>
                    <td className="border-b border-line-soft px-5 py-3 font-mono text-[12.5px] text-chalk-dim">
                      {s.couponCode}
                      {usedSet.has(s.couponCode) ? <span className="ml-2 text-signal-ok">usado</span> : null}
                    </td>
                    <td className="border-b border-line-soft px-5 py-3 text-chalk-faint">
                      {s.storefront === 'INTL' ? '.lat' : '.cl'}
                    </td>
                    <td className="border-b border-line-soft px-5 py-3 text-chalk-faint">{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
