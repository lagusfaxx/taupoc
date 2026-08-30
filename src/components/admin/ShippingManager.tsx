'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  deleteRate, deleteZone, saveRate, saveZone, toggleRate,
} from '@/actions/admin/shipping';
import type { AdminState } from '@/actions/admin/products';
import { REGIONS } from '@/lib/chile';
import { formatCLP, formatNumber } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface RateData {
  id: string;
  zoneId: string;
  carrier: string;
  label: string;
  description: string | null;
  mode: 'FLAT' | 'BY_WEIGHT' | 'BY_SUBTOTAL';
  price: number;
  minWeightG: number | null;
  maxWeightG: number | null;
  minSubtotal: number | null;
  maxSubtotal: number | null;
  freeOverSubtotal: number | null;
  etaMinDays: number;
  etaMaxDays: number;
  isPickup: boolean;
  pickupInfo: string | null;
  active: boolean;
  sortOrder: number;
}

export interface ZoneData {
  id: string;
  name: string;
  regions: string[];
  sortOrder: number;
  active: boolean;
  rates: RateData[];
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function Status({ state }: { state: AdminState | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'mb-3 border px-3.5 py-2.5 text-[13px]',
        state.ok
          ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
          : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
      )}
    >
      {state.message}
    </p>
  );
}

function ZoneForm({ zone, onDone }: { zone?: ZoneData; onDone: () => void }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveZone, null);
  const router = useRouter();
  if (state?.ok) setTimeout(() => { router.refresh(); onDone(); }, 250);

  return (
    <form action={action} className="border border-line bg-ink-800 p-5">
      {zone ? <input type="hidden" name="id" value={zone.id} /> : null}
      <Status state={state} />

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Input label="Nombre de la zona" name="name" required defaultValue={zone?.name} placeholder="Regiones centro y sur" />
        <Input label="Orden" name="sortOrder" type="number" defaultValue={String(zone?.sortOrder ?? 0)} />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 font-display text-[10px] uppercase tracking-widest text-chalk-dim">
          Regiones que cubre
        </legend>
        <p className="mb-3 text-[12px] text-chalk-faint">
          Deja todas sin marcar si la zona es solo para retiro en tienda o entrega en torneo.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {REGIONS.map((region) => (
            <label key={region.code} className="flex cursor-pointer items-center gap-2 text-[13px] text-chalk-dim">
              <input
                type="checkbox"
                name="regions"
                value={region.code}
                defaultChecked={zone?.regions.includes(region.code)}
                className="h-3.5 w-3.5 cursor-pointer appearance-none border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
              />
              {region.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <Checkbox name="active" defaultChecked={zone?.active ?? true} label="Zona activa" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Submit label={zone ? 'Guardar zona' : 'Crear zona'} />
        <button type="button" onClick={onDone} className="h-10 px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function RateForm({ zoneId, rate, onDone }: { zoneId: string; rate?: RateData; onDone: () => void }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveRate, null);
  const [mode, setMode] = useState(rate?.mode ?? 'FLAT');
  const [isPickup, setIsPickup] = useState(rate?.isPickup ?? false);
  const router = useRouter();
  if (state?.ok) setTimeout(() => { router.refresh(); onDone(); }, 250);

  return (
    <form action={action} className="border border-line bg-ink-800 p-5">
      <input type="hidden" name="zoneId" value={zoneId} />
      {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
      <Status state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Courier" name="carrier" required defaultValue={rate?.carrier ?? 'Chilexpress'} placeholder="Chilexpress" />
        <Input label="Nombre del servicio" name="label" required defaultValue={rate?.label} placeholder="Domicilio express" />
        <Input label="Descripción" hint="opcional" name="description" defaultValue={rate?.description ?? ''} className="sm:col-span-2" />

        <Select
          label="Cómo se calcula"
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="FLAT">Precio fijo</option>
          <option value="BY_WEIGHT">Por rango de peso</option>
          <option value="BY_SUBTOTAL">Por rango de monto del pedido</option>
        </Select>
        <Input
          label="Precio"
          name="price"
          defaultValue={rate ? formatNumber(rate.price) : ''}
          placeholder="4.490"
          help="En pesos. Usa 0 para envío sin costo."
        />

        {mode === 'BY_WEIGHT' ? (
          <>
            <Input label="Peso mínimo (gramos)" name="minWeightG" defaultValue={rate?.minWeightG ?? ''} placeholder="0" />
            <Input label="Peso máximo (gramos)" name="maxWeightG" defaultValue={rate?.maxWeightG ?? ''} placeholder="1000" />
          </>
        ) : null}

        {mode === 'BY_SUBTOTAL' || mode === 'FLAT' ? (
          <>
            <Input
              label="Monto mínimo del pedido"
              hint="opcional"
              name="minSubtotal"
              defaultValue={rate?.minSubtotal ? formatNumber(rate.minSubtotal) : ''}
              placeholder="0"
            />
            <Input
              label="Monto máximo del pedido"
              hint="opcional"
              name="maxSubtotal"
              defaultValue={rate?.maxSubtotal ? formatNumber(rate.maxSubtotal) : ''}
            />
          </>
        ) : null}

        <Input
          label="Envío gratis sobre"
          hint="opcional"
          name="freeOverSubtotal"
          defaultValue={rate?.freeOverSubtotal ? formatNumber(rate.freeOverSubtotal) : ''}
          placeholder="150.000"
          help="Si lo dejas vacío se usa el umbral general de Ajustes."
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Días mín." name="etaMinDays" type="number" defaultValue={String(rate?.etaMinDays ?? 2)} />
          <Input label="Días máx." name="etaMaxDays" type="number" defaultValue={String(rate?.etaMaxDays ?? 5)} />
        </div>

        <div className="sm:col-span-2">
          <Checkbox
            name="isPickup"
            checked={isPickup}
            onChange={(e) => setIsPickup(e.target.checked)}
            label="Es retiro o entrega presencial (no pide dirección de despacho)"
          />
        </div>

        {isPickup ? (
          <Textarea
            label="Instrucciones de retiro"
            name="pickupInfo"
            rows={3}
            defaultValue={rate?.pickupInfo ?? ''}
            placeholder="Av. Providencia, Santiago. Lunes a viernes de 10:00 a 19:00."
            className="sm:col-span-2"
          />
        ) : null}

        <Input label="Orden" name="sortOrder" type="number" defaultValue={String(rate?.sortOrder ?? 0)} />
        <div className="flex items-end pb-1">
          <Checkbox name="active" defaultChecked={rate?.active ?? true} label="Tarifa activa" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Submit label={rate ? 'Guardar tarifa' : 'Crear tarifa'} />
        <button type="button" onClick={onDone} className="h-10 px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk">
          Cancelar
        </button>
      </div>
    </form>
  );
}

const MODE_LABEL: Record<string, string> = {
  FLAT: 'Precio fijo',
  BY_WEIGHT: 'Por peso',
  BY_SUBTOTAL: 'Por monto',
};

export function ShippingManager({ zones }: { zones: ZoneData[] }) {
  const [editingZone, setEditingZone] = useState<string | 'new' | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [newRateZone, setNewRateZone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const regionName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? code;

  return (
    <div className={cn('space-y-5', pending && 'opacity-70')}>
      {zones.map((zone) =>
        editingZone === zone.id ? (
          <ZoneForm key={zone.id} zone={zone} onDone={() => setEditingZone(null)} />
        ) : (
          <Card
            key={zone.id}
            title={zone.name}
            description={
              zone.regions.length > 0
                ? zone.regions.map(regionName).join(' · ')
                : 'Sin regiones — solo retiro o entrega presencial'
            }
            actions={
              <>
                {!zone.active ? <Badge tone="warn">Inactiva</Badge> : null}
                <button
                  type="button"
                  onClick={() => setEditingZone(zone.id)}
                  className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
                >
                  Editar zona
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar la zona ${zone.name} y sus ${zone.rates.length} tarifas?`)) {
                      startTransition(async () => {
                        await deleteZone(zone.id);
                        router.refresh();
                      });
                    }
                  }}
                  aria-label={`Eliminar zona ${zone.name}`}
                  className="text-chalk-faint hover:text-signal-bad"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </>
            }
            padded={false}
          >
            <ul className="divide-y divide-line-soft">
              {zone.rates.map((rate) =>
                editingRate === rate.id ? (
                  <li key={rate.id} className="p-4">
                    <RateForm zoneId={zone.id} rate={rate} onDone={() => setEditingRate(null)} />
                  </li>
                ) : (
                  <li key={rate.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
                    <div className="min-w-[180px] flex-1">
                      <p className="flex items-center gap-2 text-[14px] text-chalk">
                        {rate.label}
                        {rate.isPickup ? <Badge tone="info">Retiro</Badge> : null}
                        {!rate.active ? <Badge tone="muted">Inactiva</Badge> : null}
                      </p>
                      <p className="mt-0.5 text-[12px] text-chalk-faint">
                        {rate.carrier} · {rate.etaMinDays}–{rate.etaMaxDays} días · {MODE_LABEL[rate.mode]}
                        {rate.freeOverSubtotal ? ` · gratis sobre ${formatCLP(rate.freeOverSubtotal)}` : ''}
                      </p>
                    </div>
                    <p className="font-display text-[15px] font-bold text-chalk">
                      {rate.price === 0 ? 'Gratis' : formatCLP(rate.price)}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await toggleRate(rate.id, !rate.active);
                            router.refresh();
                          })
                        }
                        className="font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
                      >
                        {rate.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRate(rate.id)}
                        className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar la tarifa ${rate.label}?`)) {
                            startTransition(async () => {
                              await deleteRate(rate.id);
                              router.refresh();
                            });
                          }
                        }}
                        aria-label={`Eliminar tarifa ${rate.label}`}
                        className="text-chalk-faint hover:text-signal-bad"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ),
              )}

              <li className="p-4">
                {newRateZone === zone.id ? (
                  <RateForm zoneId={zone.id} onDone={() => setNewRateZone(null)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewRateZone(zone.id)}
                    className="flex w-full items-center justify-center gap-2 border border-dashed border-line-bright py-3 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:border-chalk hover:text-chalk"
                  >
                    <IconPlus className="h-4 w-4" />
                    Agregar tarifa a esta zona
                  </button>
                )}
              </li>
            </ul>
          </Card>
        ),
      )}

      {editingZone === 'new' ? (
        <ZoneForm onDone={() => setEditingZone(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditingZone('new')}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-line-bright py-5 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:border-chalk hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Crear zona de envío
        </button>
      )}
    </div>
  );
}
