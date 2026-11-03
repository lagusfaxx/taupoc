'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveIntlLogo } from '@/actions/admin/international';
import type { AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { MediaField } from './MediaField';
import { Checkbox } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar logo'}
    </button>
  );
}

export function IntlLogoForm({ url, hasName }: { url: string; hasName: boolean }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveIntlLogo, null);
  return (
    <form action={action}>
      <Card
        title="Logo de taupoc.lat"
        description="Sin archivo, taupoc.lat usa el logo de taupoc.cl pasado a negro, con TAUPOC al lado. Sube uno si quieres otro distinto (oscuro, sobre fondo transparente)."
      >
        {state ? (
          <p
            role="status"
            className={cn(
              'mb-5 border px-3.5 py-2.5 text-[13.5px]',
              state.ok ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
            )}
          >
            {state.message}
          </p>
        ) : null}
        <div className="space-y-4">
          <MediaField name="intlLogoUrl" label="Logo" hint="opcional" defaultValue={url} />
          <Checkbox name="intlLogoHasName" defaultChecked={hasName} label="El archivo ya trae el nombre escrito" />
          <Submit />
        </div>
      </Card>
    </form>
  );
}
