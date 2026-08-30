'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  loginUser, registerUser, requestPasswordReset, resetPassword, type AuthState,
} from '@/actions/auth';
import { Checkbox, Input } from '@/components/ui/Field';

function Submit({ label, loading }: { label: string; loading: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-13 w-full accent-bg py-4 font-display text-[12px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:opacity-50"
    >
      {pending ? loading : label}
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

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState<AuthState | null, FormData>(loginUser, null);
  return (
    <form action={action} className="space-y-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <Alert state={state} />
      <Input label="Correo electrónico" name="email" type="email" required autoComplete="email" error={state?.fieldErrors?.email} />
      <Input label="Contraseña" name="password" type="password" required autoComplete="current-password" error={state?.fieldErrors?.password} />
      <div className="pt-1">
        <Submit label="Ingresar" loading="Ingresando…" />
      </div>
      <div className="flex items-center justify-between pt-1 text-[13px]">
        <Link href="/cuenta/recuperar" className="text-chalk-faint hover:text-chalk">
          Olvidé mi contraseña
        </Link>
        <Link href="/cuenta/registro" className="accent-text hover:underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthState | null, FormData>(registerUser, null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="name" required autoComplete="given-name" error={e.name} />
        <Input label="Apellido" hint="opcional" name="lastName" autoComplete="family-name" error={e.lastName} />
      </div>
      <Input label="Correo electrónico" name="email" type="email" required autoComplete="email" error={e.email} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Teléfono" hint="opcional" name="phone" type="tel" autoComplete="tel" error={e.phone} />
        <Input label="Club" hint="opcional" name="clubName" placeholder="Ej.: Club Náutico Ñuñoa" error={e.clubName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contraseña" name="password" type="password" required autoComplete="new-password" error={e.password} help="Mínimo 8 caracteres." />
        <Input label="Repetir contraseña" name="confirm" type="password" required autoComplete="new-password" error={e.confirm} />
      </div>
      <Checkbox
        name="acceptsMarketing"
        label="Quiero recibir avisos de reposición de tallas y fechas de torneos."
      />
      <div className="pt-1">
        <Submit label="Crear cuenta" loading="Creando cuenta…" />
      </div>
      <p className="pt-1 text-[13px] text-chalk-faint">
        ¿Ya tienes cuenta?{' '}
        <Link href="/cuenta/ingresar" className="accent-text hover:underline">Ingresa acá</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<AuthState | null, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <Input label="Correo electrónico" name="email" type="email" required autoComplete="email" />
      <div className="pt-1">
        <Submit label="Enviar enlace" loading="Enviando…" />
      </div>
      <p className="pt-1 text-[13px] text-chalk-faint">
        <Link href="/cuenta/ingresar" className="hover:text-chalk">← Volver a ingresar</Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState | null, FormData>(resetPassword, null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Alert state={state} />
      <Input label="Nueva contraseña" name="password" type="password" required autoComplete="new-password" error={e.password} help="Mínimo 8 caracteres." />
      <Input label="Repetir contraseña" name="confirm" type="password" required autoComplete="new-password" error={e.confirm} />
      <div className="pt-1">
        <Submit label="Guardar contraseña" loading="Guardando…" />
      </div>
    </form>
  );
}
