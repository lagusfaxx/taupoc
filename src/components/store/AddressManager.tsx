'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteAddress, saveAddress, type AuthState } from '@/actions/auth';
import { REGIONS, communesOf } from '@/lib/chile';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface AddressData {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  number: string;
  extra: string | null;
  commune: string;
  region: string;
  postalCode: string | null;
  isDefault: boolean;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-6 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar dirección'}
    </button>
  );
}

function AddressForm({ address, onDone }: { address?: AddressData; onDone: () => void }) {
  const [state, action] = useActionState<AuthState | null, FormData>(saveAddress, null);
  const [region, setRegion] = useState(address?.region ?? '');
  const communes = useMemo(() => communesOf(region), [region]);
  const router = useRouter();
  const e = state?.fieldErrors ?? {};

  if (state?.ok) {
    setTimeout(() => {
      router.refresh();
      onDone();
    }, 300);
  }

  return (
    <form action={action} className="space-y-4 surface p-6">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {state && !state.ok ? (
        <p role="alert" className="border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}

      <Input label="Etiqueta" hint="opcional" name="label" defaultValue={address?.label ?? ''} placeholder="Casa, club, trabajo…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="firstName" required defaultValue={address?.firstName} error={e.firstName} />
        <Input label="Apellido" name="lastName" required defaultValue={address?.lastName} error={e.lastName} />
      </div>
      <Input label="Teléfono" name="phone" type="tel" required defaultValue={address?.phone} error={e.phone} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Región"
          name="region"
          required
          value={region}
          onChange={(ev) => setRegion(ev.target.value)}
          error={e.region}
        >
          <option value="">Selecciona tu región</option>
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>{r.name}</option>
          ))}
        </Select>
        <Select label="Comuna" name="commune" required defaultValue={address?.commune ?? ''} error={e.commune} disabled={!region}>
          <option value="">{region ? 'Selecciona tu comuna' : 'Elige primero la región'}</option>
          {communes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Input label="Calle" name="street" required defaultValue={address?.street} error={e.street} />
        <Input label="Número" name="number" required defaultValue={address?.number} error={e.number} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Depto. / referencia" hint="opcional" name="extra" defaultValue={address?.extra ?? ''} />
        <Input label="Código postal" hint="opcional" name="postalCode" defaultValue={address?.postalCode ?? ''} />
      </div>
      <Checkbox name="isDefault" defaultChecked={address?.isDefault} label="Usar como dirección principal" />

      <div className="flex items-center gap-3 pt-1">
        <Submit />
        <button
          type="button"
          onClick={onDone}
          className="h-11 px-4 font-display text-[11px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: AddressData[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(addresses.length === 0 ? 'new' : null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove(id: string) {
    startTransition(async () => {
      await deleteAddress(id);
      router.refresh();
    });
  }

  const regionName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? code;

  return (
    <div className="space-y-5">
      {addresses.map((address) =>
        editing === address.id ? (
          <AddressForm key={address.id} address={address} onDone={() => setEditing(null)} />
        ) : (
          <div key={address.id} className="surface flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="font-display text-[13px] uppercase tracking-wide text-chalk">
                  {address.label || 'Dirección'}
                </p>
                {address.isDefault ? <Badge tone="accent">Principal</Badge> : null}
              </div>
              <address className="mt-2 not-italic text-[13.5px] leading-relaxed text-chalk-faint">
                {address.firstName} {address.lastName}<br />
                {address.street} {address.number}
                {address.extra ? `, ${address.extra}` : ''}<br />
                {address.commune}, {regionName(address.region)}<br />
                {address.phone}
              </address>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(address.id)}
                className="font-display text-[11px] uppercase tracking-widest text-chalk-dim hover:accent-text"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove(address.id)}
                disabled={pending}
                aria-label="Eliminar dirección"
                className="text-chalk-faint hover:text-signal-bad disabled:opacity-40"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
        ),
      )}

      {editing === 'new' ? (
        <AddressForm onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-line-bright py-5 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:border-chalk hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar dirección
        </button>
      )}
    </div>
  );
}
