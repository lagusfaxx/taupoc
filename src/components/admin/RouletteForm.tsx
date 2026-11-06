'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateRoulette } from '@/actions/admin/roulette';
import type { AdminState } from '@/actions/admin/products';
import type { RouletteConfig, RoulettePrize, RoulettePrizeType } from '@/lib/roulette';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Checkbox, Input } from '@/components/ui/Field';

const TYPE_LABEL: Record<RoulettePrizeType, string> = {
  PERCENT: '% descuento',
  FIXED: 'Monto fijo (CLP)',
  FREE_SHIPPING: 'Envío gratis',
};

const CELL =
  'w-full border border-line bg-ink-900 px-2.5 py-2 text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar ruleta'}
    </button>
  );
}

function suggestLabel(p: RoulettePrize): string {
  if (p.type === 'FREE_SHIPPING') return 'Envío gratis';
  if (p.type === 'PERCENT') return `${p.value}% OFF`;
  return `$${p.value.toLocaleString('es-CL')} OFF`;
}

function PrizeEditor({
  prizes,
  onChange,
  lat,
}: {
  prizes: RoulettePrize[];
  onChange: (next: RoulettePrize[]) => void;
  lat: boolean;
}) {
  const counts = (p: RoulettePrize) => p.weight > 0 && !(lat && p.type === 'FREE_SHIPPING');
  const total = prizes.filter(counts).reduce((s, p) => s + p.weight, 0);
  const set = (i: number, patch: Partial<RoulettePrize>) =>
    onChange(
      prizes.map((p, j) => {
        if (j !== i) return p;
        const next = { ...p, ...patch };
        // Si el texto era el sugerido, se actualiza con el tipo y el valor.
        if (('type' in patch || 'value' in patch) && p.label === suggestLabel(p)) next.label = suggestLabel(next);
        return next;
      }),
    );

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
              <th className="border-b border-line px-2 py-2.5">Texto en la rueda</th>
              <th className="border-b border-line px-2 py-2.5">Tipo</th>
              <th className="border-b border-line px-2 py-2.5">Valor</th>
              <th className="border-b border-line px-2 py-2.5">Peso</th>
              <th className="border-b border-line px-2 py-2.5 text-right">Probabilidad</th>
              <th className="border-b border-line px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {prizes.map((p, i) => {
              const off = !counts(p);
              return (
                <tr key={p.id} className={cn(off && 'opacity-50')}>
                  <td className="border-b border-line-soft px-2 py-2">
                    <input
                      value={p.label}
                      maxLength={16}
                      onChange={(e) => set(i, { label: e.target.value })}
                      className={CELL}
                      aria-label="Texto en la rueda"
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-2">
                    <select
                      value={p.type}
                      onChange={(e) => set(i, { type: e.target.value as RoulettePrizeType })}
                      className={CELL}
                      aria-label="Tipo"
                    >
                      {(Object.keys(TYPE_LABEL) as RoulettePrizeType[]).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-line-soft px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={p.type === 'FREE_SHIPPING' ? '' : p.value}
                      disabled={p.type === 'FREE_SHIPPING'}
                      onChange={(e) => set(i, { value: Math.max(0, Number(e.target.value) || 0) })}
                      className={cn(CELL, 'w-28')}
                      aria-label="Valor"
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={p.weight}
                      onChange={(e) => set(i, { weight: Math.max(0, Number(e.target.value) || 0) })}
                      className={cn(CELL, 'w-20')}
                      aria-label="Peso"
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-2 text-right tabular-nums text-chalk">
                    {off ? (lat && p.type === 'FREE_SHIPPING' ? 'No aplica en .lat' : 'Fuera de la rueda') : `${((p.weight / total) * 100).toFixed(1)}%`}
                  </td>
                  <td className="border-b border-line-soft px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(prizes.filter((_, j) => j !== i))}
                      className="px-2 text-[13px] text-chalk-faint hover:text-signal-bad"
                      aria-label={`Quitar ${p.label}`}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {prizes.length < 10 ? (
        <button
          type="button"
          onClick={() =>
            onChange([
              ...prizes,
              { id: `p${Date.now().toString(36)}`, label: '5% OFF', type: 'PERCENT', value: 5, weight: 10 },
            ])
          }
          className="mt-3 border border-line px-3.5 py-2 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
        >
          Agregar premio
        </button>
      ) : null}
    </div>
  );
}

export function RouletteForm({ config }: { config: RouletteConfig }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateRoulette, null);
  const [prizesCL, setPrizesCL] = useState(config.prizesCL);
  const [prizesINTL, setPrizesINTL] = useState(config.prizesINTL);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="prizesCL" value={JSON.stringify(prizesCL)} />
      <input type="hidden" name="prizesINTL" value={JSON.stringify(prizesINTL)} />

      {state ? (
        <p
          role="status"
          className={cn(
            'border px-3.5 py-2.5 text-[13.5px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Publicación">
          <div className="space-y-4">
            <Checkbox
              name="enabled"
              defaultChecked={config.enabled}
              label="Ruleta activa"
              help="Apagada no aparece en ninguna tienda. Los cupones ya entregados siguen valiendo."
            />
            <Checkbox name="showCL" defaultChecked={config.showCL} label="Mostrar en taupoc.cl" />
            <Checkbox name="showINTL" defaultChecked={config.showINTL} label="Mostrar en taupoc.lat" />
          </div>
        </Card>

        <Card title="Cupón">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Vigencia (días)"
              name="couponDays"
              type="number"
              min={1}
              max={90}
              defaultValue={String(config.couponDays)}
            />
            <Input
              label="Compra mínima (CLP)"
              name="minSubtotal"
              type="number"
              min={0}
              defaultValue={String(config.minSubtotal)}
              help="0 = sin mínimo. En .lat se convierte a dólares."
            />
          </div>
          <p className="mt-4 text-[13px] text-chalk-faint">
            Cada giro crea un cupón GIRO- de un solo uso, visible en Cupones. Un giro por correo.
          </p>
        </Card>

        <Card title="Textos">
          <div className="grid gap-4">
            <Input label="Título" name="title" maxLength={60} defaultValue={config.title} />
            <Input label="Texto del botón" name="buttonLabel" maxLength={24} defaultValue={config.buttonLabel} />
          </div>
        </Card>

        <Card title="Cuándo aparece">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Abrir sola a los (segundos)"
              name="autoOpenSeconds"
              type="number"
              min={0}
              max={600}
              defaultValue={String(config.autoOpenSeconds)}
              help="0 = solo con el botón."
            />
            <Input
              label="Si la cierran, esperar (días)"
              name="snoozeDays"
              type="number"
              min={0}
              max={60}
              defaultValue={String(config.snoozeDays)}
              help="Antes de volver a abrirse sola."
            />
          </div>
          <Checkbox
            className="mt-4"
            name="exitIntent"
            defaultChecked={config.exitIntent}
            label="Abrir al ir a salir de la página"
            help="En computador, cuando el mouse sale por arriba de la ventana."
          />
        </Card>
      </div>

      <Card
        title="Premios taupoc.cl"
        description="El peso define la probabilidad. Peso 0 saca el premio de la rueda."
      >
        <PrizeEditor prizes={prizesCL} onChange={setPrizesCL} lat={false} />
      </Card>

      <Card
        title="Premios taupoc.lat"
        description="El envío gratis no se puede usar en .lat. El monto fijo se convierte a dólares."
      >
        <PrizeEditor prizes={prizesINTL} onChange={setPrizesINTL} lat />
      </Card>

      <Submit />
    </form>
  );
}
