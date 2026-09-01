'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendTestEmail } from '@/actions/admin/mail-test';
import type { AdminState } from '@/actions/admin/products';
import { PLANTILLAS_DE_PRUEBA } from '@/lib/mail-kinds';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Input, Select } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full border border-line-bright px-6 font-display text-[11px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk-faint disabled:opacity-50 sm:w-auto"
    >
      {pending ? 'Enviando…' : 'Enviar prueba'}
    </button>
  );
}

/**
 * Manda una plantilla de correo a la dirección que se escriba.
 *
 * Va fuera del formulario de Configuración a propósito: ese es un único
 * `<form>` gigante y anidar otro dentro no es HTML válido.
 */
export function MailTester({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState<AdminState | null, FormData>(sendTestEmail, null);

  return (
    <Card
      title="Probar plantillas de correo"
      description="Envía cualquiera de los correos con un pedido de ejemplo, sin tener que generar una compra."
      className="mt-6"
    >
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select label="Plantilla" name="kind" defaultValue="paid">
          {PLANTILLAS_DE_PRUEBA.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>

        <Input
          label="Enviar a"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="tu@correo.cl"
        />

        <Submit />
      </form>

      {state ? (
        <p
          role="status"
          className={cn(
            'mt-4 border px-3.5 py-2.5 text-[13.5px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-faint">
        El pedido es inventado (TP-PRUEBA) y no toca el inventario ni el historial. La prueba se
        envía aunque las notificaciones estén apagadas, para que puedas revisar el diseño antes de
        encenderlas.
      </p>
    </Card>
  );
}
