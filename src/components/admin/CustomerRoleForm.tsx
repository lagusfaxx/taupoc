'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateUserRole } from '@/actions/admin/customers';
import type { AdminState } from '@/actions/admin/products';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 border border-line-bright px-5 font-display text-[11px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Actualizar permisos'}
    </button>
  );
}

export function CustomerRoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateUserRole, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {state ? (
        <p
          role="status"
          className={cn(
            'border px-3.5 py-2.5 text-[13px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}
      <Select label="Rol" name="role" defaultValue={role}>
        <option value="CUSTOMER">Cliente — solo la tienda</option>
        <option value="STAFF">Equipo — acceso al panel</option>
        <option value="ADMIN">Administrador — acceso total</option>
      </Select>
      <Submit />
    </form>
  );
}
