import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { rangeFor, recentSizeInterests, sizeDemand } from '@/lib/reports';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { PeriodPicker } from '@/components/admin/PeriodPicker';
import { cn } from '@/lib/utils';
import { discardPersonInterests, toggleSizeInterest } from '@/actions/admin/size-interest';

/** Más tallas que esto de un mismo modelo y se marca como sospechoso. */
const SOSPECHOSO = 3;

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Demanda de tallas', noIndex: true });

const PERIODS = ['semana', 'mes', '30d', '90d', 'anio'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  semana: 'Esta semana',
  mes: 'Este mes',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  anio: 'Este año',
};

const dateFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—';
}

export default async function SizeDemandPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const raw = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo;
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : '30d';
  const { from, to } = rangeFor(period);

  const [{ sizes, variants }, interests] = await Promise.all([
    sizeDemand(from, to),
    recentSizeInterests(from, to),
  ]);

  const totals = sizes.reduce(
    (acc, s) => ({
      added: acc.added + s.added,
      sold: acc.sold + s.sold,
      abandoned: acc.abandoned + s.abandoned,
      interest: acc.interest + s.interest,
      people: acc.people + s.interestPeople,
    }),
    { added: 0, sold: 0, abandoned: 0, interest: 0, people: 0 },
  );
  const maxBar = Math.max(1, ...sizes.map((s) => Math.max(s.added, s.sold + s.abandoned) + s.interest));
  const toOrder = variants.filter((v) => v.suggested > 0);

  return (
    <>
      <PageHeader
        title="Demanda de tallas"
        description={`Carrito, ventas e interés por tallas agotadas · ${PERIOD_LABEL[period]}`}
      />

      <PeriodPicker periods={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} current={period} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agregadas al carrito" value={String(totals.added)} hint="Unidades" />
        <StatCard label="Vendidas" value={String(totals.sold)} hint={`Conversión ${pct(totals.sold, totals.added)}`} tone="accent" />
        <StatCard label="Agregadas sin comprar" value={String(totals.abandoned)} hint={`Abandono ${pct(totals.abandoned, totals.added)}`} />
        <StatCard
          label="Interés en agotadas"
          value={String(Math.round(totals.interest))}
          hint={`${totals.people} personas con correo · peso ajustado`}
        />
      </div>

      <div className="mt-5">
        <Card
          title="Por talla"
          description="Vendidas, abandonadas en el carrito e interés en tallas agotadas."
          padded={false}
        >
          <div className="flex flex-wrap gap-4 border-b border-line px-5 py-3 text-[12px] text-chalk-dim">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 accent-bg" />Vendidas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-signal-warn" />Sin comprar</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-signal-bad" />Interés agotadas</span>
          </div>
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Talla</Th>
                <Th className="w-[34%]">Demanda</Th>
                <Th align="center">Al carrito</Th>
                <Th align="center">Vendidas</Th>
                <Th align="center">Sin comprar</Th>
                <Th align="center">Abandono</Th>
                <Th align="center">Interés</Th>
                <Th align="center">Stock hoy</Th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <Tr key={s.size}>
                  <Td className="font-display text-[15px] font-bold text-chalk">{s.size}</Td>
                  <Td>
                    <span className="flex h-2.5 w-full bg-ink-700">
                      <span className="block h-full accent-bg" style={{ width: `${(s.sold / maxBar) * 100}%` }} />
                      <span className="block h-full bg-signal-warn" style={{ width: `${(s.abandoned / maxBar) * 100}%` }} />
                      <span className="block h-full bg-signal-bad" style={{ width: `${(s.interest / maxBar) * 100}%` }} />
                    </span>
                  </Td>
                  <Td align="center">{s.added}</Td>
                  <Td align="center" className="text-chalk">{s.sold}</Td>
                  <Td align="center" className={s.abandoned > 0 ? 'text-signal-warn' : undefined}>{s.abandoned}</Td>
                  <Td align="center">{pct(s.abandoned, s.added)}</Td>
                  <Td align="center" className={s.interest > 0 ? 'font-semibold text-signal-bad' : undefined}>
                    {s.interest}
                    {s.interestPeople > 0 ? (
                      <span className="block text-[11px] font-normal text-chalk-faint">{s.interestPeople} pers.</span>
                    ) : null}
                  </Td>
                  <Td align="center" className={s.stock === 0 ? 'text-signal-bad' : undefined}>{s.stock}</Td>
                </Tr>
              ))}
              {sizes.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-chalk-faint">Sin datos en el período.</td></tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="mt-5">
        <Card
          title="Pedir a fábrica"
          description="Sugerido = vendidas + sin comprar + interés − stock. El carrito cuenta máx. 2 unidades por cliente; el interés exige correo y se reparte si alguien marca muchas tallas."
          padded={false}
        >
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>Color</Th>
                <Th align="center">Talla</Th>
                <Th align="center">Vendidas</Th>
                <Th align="center">Sin comprar</Th>
                <Th align="center">Interés</Th>
                <Th align="center">Stock</Th>
                <Th align="right">Sugerido</Th>
              </tr>
            </thead>
            <tbody>
              {toOrder.map((v) => (
                <Tr key={v.variantId}>
                  <Td className="text-chalk">
                    {v.productName}
                    <span className="ml-2 font-mono text-[11.5px] text-chalk-faint">{v.sku}</span>
                    {!v.active ? <span className="ml-2 text-[11px] uppercase text-chalk-faint">apagada</span> : null}
                  </Td>
                  <Td>{v.colorName}</Td>
                  <Td align="center" className="font-display font-bold text-chalk">{v.size}</Td>
                  <Td align="center">{v.sold}</Td>
                  <Td align="center">{v.abandoned}</Td>
                  <Td align="center" className={v.interest > 0 ? 'text-signal-bad' : undefined}>
                    {v.interest}
                    {v.interestPeople > 0 ? (
                      <span className="block text-[11px] text-chalk-faint">{v.interestPeople} pers.</span>
                    ) : null}
                  </Td>
                  <Td align="center" className={cn(v.stock === 0 && 'text-signal-bad')}>{v.stock}</Td>
                  <Td align="right" className="font-display text-[15px] font-bold accent-text">{v.suggested}</Td>
                </Tr>
              ))}
              {toOrder.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-chalk-faint">El stock cubre la demanda del período.</td></tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="mt-5">
        <Card
          title="Avisos de reposición"
          description={`Quién pidió cada talla. «Sospechoso» = marcó más de ${SOSPECHOSO} tallas del mismo modelo; descartado no cuenta.`}
          padded={false}
        >
          <Table minWidth={820}>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Correo</Th>
                <Th>Producto</Th>
                <Th align="center">Talla</Th>
                <Th align="center">Stock hoy</Th>
                <Th align="right">Revisión</Th>
              </tr>
            </thead>
            <tbody>
              {interests.map((i) => {
                const stock = Math.max(0, i.variant.stock - i.variant.reserved);
                const sospechoso = !i.discarded && i.sizesMarked > SOSPECHOSO;
                return (
                  <Tr key={i.id}>
                    <Td className={cn('whitespace-nowrap', i.discarded && 'opacity-50')}>{dateFmt.format(i.createdAt)}</Td>
                    <Td className={cn('text-chalk', i.discarded && 'line-through opacity-50')}>
                      {i.email ?? <span className="text-chalk-faint">sin correo</span>}
                      {sospechoso ? (
                        <span className="ml-2 border border-signal-warn/50 px-1.5 py-0.5 text-[10.5px] uppercase text-signal-warn">
                          Sospechoso · {i.sizesMarked} tallas
                        </span>
                      ) : null}
                    </Td>
                    <Td className={cn(i.discarded && 'opacity-50')}>{i.variant.product.name} · {i.variant.color.name}</Td>
                    <Td align="center" className="font-display font-bold text-chalk">{i.variant.size}</Td>
                    <Td align="center" className={stock > 0 ? 'text-signal-ok' : 'text-signal-bad'}>{stock}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <form action={toggleSizeInterest.bind(null, i.id, !i.discarded)}>
                          <button type="submit" className="text-[12px] underline underline-offset-2 hover:text-chalk">
                            {i.discarded ? 'Recuperar' : 'Descartar'}
                          </button>
                        </form>
                        {sospechoso ? (
                          <form action={discardPersonInterests.bind(null, i.id)}>
                            <button type="submit" className="text-[12px] text-signal-warn underline underline-offset-2">
                              Descartar todo de esta persona
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
              {interests.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-chalk-faint">Nadie ha pedido tallas en el período.</td></tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
