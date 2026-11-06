'use client';

import { useActionState, useEffect, useId, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { submitWholesaleQuote, type QuoteState } from '@/actions/quote';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light';

const LATAM = [
  'Argentina', 'Bolivia', 'Colombia', 'Costa Rica', 'Ecuador', 'El Salvador', 'Guatemala', 'Honduras',
  'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'Puerto Rico', 'República Dominicana', 'Uruguay',
  'Venezuela', 'Otro',
];

function styles(theme: Theme) {
  const dark = theme === 'dark';
  return {
    label: dark
      ? 'mb-1.5 block font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim'
      : 'mb-1.5 block text-[13px] text-graphite-soft',
    control: dark
      ? 'w-full border border-line bg-ink-900 px-3.5 py-3 text-[16px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none sm:text-[15px]'
      : 'w-full border border-hairline bg-white px-3.5 py-3 text-[16px] text-graphite placeholder:text-graphite-soft/70 focus:border-graphite focus:outline-none sm:text-[15px]',
    error: dark ? 'border-signal-bad' : 'border-[#E5484D]',
    errorText: dark ? 'text-signal-bad' : 'text-[#E5484D]',
    hint: dark ? 'text-chalk-faint' : 'text-graphite-soft',
    box: dark ? 'surface p-6 sm:p-8' : 'border border-hairline bg-white p-6 sm:p-8',
    button: dark
      ? 'accent-bg font-display font-bold clip-notch-sm hover:brightness-110'
      : 'bg-graphite text-paper hover:bg-black',
  };
}

function Field({
  theme,
  label,
  name,
  error,
  optional,
  className,
  ...props
}: {
  theme: Theme;
  label: string;
  name: string;
  error?: string;
  optional?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const s = styles(theme);
  return (
    <div className={className}>
      <label htmlFor={id} className={s.label}>
        {label}
        {optional ? <span className={cn('ml-1.5 normal-case tracking-normal', s.hint)}>(opcional)</span> : null}
      </label>
      <input id={id} name={name} className={cn(s.control, error && s.error)} {...props} />
      {error ? <p className={cn('mt-1.5 text-[13px]', s.errorText)}>{error}</p> : null}
    </div>
  );
}

function Submit({ theme }: { theme: Theme }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'h-13 w-full py-4 text-[12px] uppercase tracking-widest transition-all disabled:opacity-50 sm:w-auto sm:px-10',
        styles(theme).button,
      )}
    >
      {pending ? 'Enviando…' : 'Pedir precios mayoristas'}
    </button>
  );
}

/** Formulario de cotización para tiendas que compran por mayor. */
export function WholesaleForm({ theme = 'dark', market }: { theme?: Theme; market: 'CL' | 'INTL' }) {
  const [state, action] = useActionState<QuoteState | null, FormData>(submitWholesaleQuote, null);
  const e = state?.fieldErrors ?? {};
  const s = styles(theme);
  const doneRef = useRef<HTMLDivElement>(null);
  const countryId = useId();
  const messageId = useId();

  useEffect(() => {
    if (state?.ok) doneRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [state?.ok]);

  if (state?.ok) {
    return (
      <div ref={doneRef} className={cn(s.box, 'scroll-mt-28')}>
        <h3 className={cn('text-[18px]', theme === 'dark' ? 'font-display text-chalk' : 'text-graphite')}>
          Solicitud enviada
        </h3>
        <p className={cn('mt-2 text-[15px] leading-relaxed', s.hint)}>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className={cn(s.box, 'space-y-4')}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute h-0 w-0 opacity-0" />

      {state && !state.ok ? (
        <p role="alert" className={cn('text-[14px]', s.errorText)}>
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field theme={theme} label="Nombre de la tienda" name="clubName" required error={e.clubName} className="sm:col-span-2" />
        <Field
          theme={theme}
          label={market === 'CL' ? 'RUT de la empresa' : 'Identificación tributaria'}
          name="taxId"
          optional
          placeholder={market === 'CL' ? '76.123.456-7' : ''}
        />
        <Field theme={theme} label="Web o Instagram" name="storeUrl" optional placeholder="@tutienda" />
        <Field theme={theme} label="Tu nombre" name="contactName" required autoComplete="name" error={e.contactName} />
        <Field theme={theme} label="Correo" name="email" type="email" required autoComplete="email" error={e.email} />
        <Field theme={theme} label="Teléfono / WhatsApp" name="phone" type="tel" required autoComplete="tel" error={e.phone} />
        {market === 'INTL' ? (
          <div>
            <label htmlFor={countryId} className={s.label}>País</label>
            <select id={countryId} name="country" className={s.control} defaultValue="">
              <option value="">Selecciona</option>
              {LATAM.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <Field theme={theme} label="Ciudad" name="country" optional placeholder="Concepción" />
        )}
        <Field
          theme={theme}
          label="Unidades por pedido"
          name="athletes"
          type="number"
          min={1}
          placeholder="20"
          optional
          error={e.athletes}
          className="sm:col-span-2"
        />
      </div>

      <div>
        <label htmlFor={messageId} className={s.label}>
          Qué te interesa <span className={cn('ml-1 normal-case tracking-normal', s.hint)}>(opcional)</span>
        </label>
        <textarea
          id={messageId}
          name="message"
          rows={4}
          placeholder="Modelos, tallas y colores que más vendes."
          className={cn(s.control, 'resize-y')}
        />
      </div>

      <div className="pt-1">
        <Submit theme={theme} />
      </div>
    </form>
  );
}
