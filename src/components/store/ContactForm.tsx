'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitContact, type ContactState } from '@/actions/contact';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { IconCheck } from '@/components/ui/Icons';

const SUBJECTS = [
  'Consulta de talla',
  'Estado de mi pedido',
  'Cambio o devolución',
  'Cotización para club',
  'Disponibilidad de stock',
  'Otro',
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-13 w-full accent-bg py-4 font-display text-[12px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-10"
    >
      {pending ? 'Enviando…' : 'Enviar mensaje'}
    </button>
  );
}

export function ContactForm() {
  const [state, action] = useActionState<ContactState | null, FormData>(submitContact, null);
  const e = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div className="surface flex items-start gap-4 p-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-signal-ok/40 bg-signal-ok/10 text-signal-ok">
          <IconCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-[17px] tracking-tight text-chalk">Mensaje enviado</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="surface space-y-4 p-6 sm:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute h-0 w-0 opacity-0" />

      {state && !state.ok ? (
        <p role="alert" className="border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="name" required error={e.name} />
        <Input label="Correo electrónico" name="email" type="email" required error={e.email} />
        <Input label="Teléfono" hint="opcional" name="phone" type="tel" />
        <Select label="Motivo" name="subject" required error={e.subject}>
          <option value="">Selecciona un motivo</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <Textarea
        label="Mensaje"
        name="message"
        required
        rows={6}
        error={e.message}
        placeholder="Si es una consulta de talla, incluye cintura, cadera y estatura del nadador, y la prueba que nada."
      />

      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}
