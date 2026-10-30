'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveExchangeRate } from '@/actions/admin/international';
import type { AdminState } from '@/actions/admin/products';
import { clpToIntlCents, formatUsdCents, ROUNDING_LABEL, type FxConfig, type PriceRoundingRule } from '@/lib/fx';
import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Input, Select } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar tipo de cambio'}
    </button>
  );
}

const num = (v: string) => Number(v.replace(',', '.'));

/**
 * Tipo de cambio de taupoc.lat con vista previa: mientras se escribe se ve
 * cuánto queda cada producto en dólares, antes de guardar.
 */
export function ExchangeRateForm({
  current,
  products,
}: {
  current: FxConfig | null;
  products: { id: string; name: string; clp: number }[];
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveExchangeRate, null);
  const [form, setForm] = useState({
    clpPerUsd: String(current?.clpPerUsd ?? ''),
    marginPct: String(current?.marginPct ?? 18),
    vatPct: String(current?.vatPct ?? 19),
    rounding: (current?.rounding ?? 'WHOLE_9') as PriceRoundingRule,
  });
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const preview = useMemo(() => {
    const fx: FxConfig = {
      clpPerUsd: num(form.clpPerUsd),
      marginPct: num(form.marginPct),
      vatPct: num(form.vatPct),
      rounding: form.rounding,
    };
    if (!(fx.clpPerUsd > 0) || !Number.isFinite(fx.marginPct) || !Number.isFinite(fx.vatPct)) return null;
    return products.map((p) => ({ ...p, cents: clpToIntlCents(p.clp, fx) }));
  }, [form, products]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-2">
      <Card
        title="Tipo de cambio"
        description="El precio en dólares sale del precio chileno sin IVA (la venta al extranjero es exportación), dividido por el tipo de cambio, más el margen, redondeado hacia arriba."
      >
        {state ? (
          <p
            role="status"
            className={cn(
              'mb-5 border px-3.5 py-2.5 text-[13.5px]',
              state.ok
                ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
            )}
          >
            {state.message}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Pesos por dólar"
            name="clpPerUsd"
            inputMode="decimal"
            value={form.clpPerUsd}
            onChange={set('clpPerUsd')}
            help="Dólar observado o el que uses de referencia."
          />
          <Input
            label="Margen (%)"
            name="marginPct"
            inputMode="decimal"
            value={form.marginPct}
            onChange={set('marginPct')}
            help="Cubre la comisión de PayPal, la conversión y la variación del dólar."
          />
          <Input
            label="IVA que se descuenta (%)"
            name="vatPct"
            inputMode="decimal"
            value={form.vatPct}
            onChange={set('vatPct')}
            help="Los precios chilenos lo incluyen; la exportación no lo lleva."
          />
          <Select label="Redondeo" name="rounding" value={form.rounding} onChange={set('rounding')}>
            {(Object.keys(ROUNDING_LABEL) as PriceRoundingRule[]).map((r) => (
              <option key={r} value={r}>
                {ROUNDING_LABEL[r]}
              </option>
            ))}
          </Select>
          <Input label="Nota" hint="opcional" name="note" className="sm:col-span-2" placeholder="Ej.: ajuste por alza del dólar" />
        </div>
        <div className="mt-6">
          <Submit />
        </div>
      </Card>

      <Card title="Así quedan los precios" description="Vista previa con los valores del formulario, antes de guardar.">
        {preview ? (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-chalk-faint">
                <th className="pb-2 font-normal">Producto</th>
                <th className="pb-2 text-right font-normal">taupoc.cl</th>
                <th className="pb-2 text-right font-normal">taupoc.lat</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.id} className="border-t border-line-soft">
                  <td className="py-2.5 text-chalk">{p.name}</td>
                  <td className="py-2.5 text-right text-chalk-dim">{formatCLP(p.clp)}</td>
                  <td className="py-2.5 text-right font-semibold text-chalk">{formatUsdCents(p.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13.5px] text-chalk-faint">Ingresa un tipo de cambio para ver los precios.</p>
        )}
      </Card>
    </form>
  );
}
