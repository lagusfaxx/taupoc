'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { submitQuote, type QuoteState } from '@/actions/quote';
import { REGIONS } from '@/lib/chile';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { IconCheck } from '@/components/ui/Icons';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-13 w-full accent-bg py-4 font-display text-[12px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-10"
    >
      {pending ? 'Enviando…' : 'Solicitar cotización'}
    </button>
  );
}

export function QuoteForm() {
  const [state, action] = useActionState<QuoteState | null, FormData>(submitQuote, null);
  const e = state?.fieldErrors ?? {};
  const doneRef = useRef<HTMLDivElement>(null);

  // El encabezado es fijo: sin esto la confirmación queda oculta detrás.
  useEffect(() => {
    if (state?.ok) doneRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [state?.ok]);

  if (state?.ok) {
    return (
      <div ref={doneRef} className="surface flex items-start gap-4 p-7 scroll-mt-28">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-signal-ok/40 bg-signal-ok/10 text-signal-ok">
          <IconCheck className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-[17px] tracking-tight text-chalk">Solicitud enviada</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="surface space-y-4 p-6 sm:p-8">
      {/* Campo trampa oculto para bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute h-0 w-0 opacity-0"
      />

      {state && !state.ok ? (
        <p role="alert" className="border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre del club" name="clubName" required error={e.clubName} className="sm:col-span-2" />
        <Input label="Tu nombre" name="contactName" required error={e.contactName} />
        <Input label="Cargo" hint="opcional" name="interest" placeholder="Entrenador, dirigente, apoderado…" />
        <Input label="Correo electrónico" name="email" type="email" required error={e.email} />
        <Input label="Teléfono / WhatsApp" name="phone" type="tel" required error={e.phone} />
        <Select label="Región" hint="opcional" name="region">
          <option value="">Selecciona tu región</option>
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>{r.name}</option>
          ))}
        </Select>
        <Input
          label="Nadadores a equipar"
          hint="aproximado"
          name="athletes"
          type="number"
          min={1}
          placeholder="24"
          error={e.athletes}
        />
      </div>

      <Textarea
        label="Cuéntanos qué necesitas"
        name="message"
        rows={5}
        placeholder="Ej.: 18 jammers y 12 knee suits para el nacional de noviembre. Necesitamos asesoría de tallas para categoría infantil."
      />

      <div className="pt-2">
        <Submit />
      </div>

      <p className="text-[12.5px] leading-relaxed text-chalk-faint">
        Respondemos dentro de 24 horas hábiles con precios por volumen, disponibilidad de tallas y
        alternativas de entrega.
      </p>
    </form>
  );
}
