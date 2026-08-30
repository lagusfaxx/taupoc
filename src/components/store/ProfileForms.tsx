'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { changePassword, updateProfile, type AuthState } from '@/actions/auth';
import { Checkbox, Input } from '@/components/ui/Field';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 border border-line-bright px-6 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function Alert({ state }: { state: AuthState | null }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? 'status' : 'alert'}
      className={`border px-3.5 py-2.5 text-[13.5px] ${
        state.ok
          ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
          : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad'
      }`}
    >
      {state.message}
    </p>
  );
}

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; lastName: string; phone: string; clubName: string; acceptsMarketing: boolean };
}) {
  const [state, action] = useActionState<AuthState | null, FormData>(updateProfile, null);
  const e = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="name" required defaultValue={defaults.name} error={e.name} />
        <Input label="Apellido" hint="opcional" name="lastName" defaultValue={defaults.lastName} error={e.lastName} />
        <Input label="Teléfono" hint="opcional" name="phone" type="tel" defaultValue={defaults.phone} error={e.phone} />
        <Input label="Club" hint="opcional" name="clubName" defaultValue={defaults.clubName} error={e.clubName} />
      </div>
      <Checkbox
        name="acceptsMarketing"
        defaultChecked={defaults.acceptsMarketing}
        label="Quiero recibir avisos de reposición de tallas y fechas de torneos."
      />
      <div className="pt-1">
        <Submit label="Guardar cambios" />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<AuthState | null, FormData>(changePassword, null);
  const e = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <Input label="Contraseña actual" name="current" type="password" required autoComplete="current-password" error={e.current} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nueva contraseña" name="password" type="password" required autoComplete="new-password" error={e.password} />
        <Input label="Repetir contraseña" name="confirm" type="password" required autoComplete="new-password" error={e.confirm} />
      </div>
      <div className="pt-1">
        <Submit label="Cambiar contraseña" />
      </div>
    </form>
  );
}
