'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { subscribeNewsletter, type ActionState } from '@/actions/newsletter';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 shrink-0 accent-bg px-6 font-display text-[11px] font-semibold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Enviando…' : 'Suscribirme'}
    </button>
  );
}

export function NewsletterForm({ source = 'footer' }: { source?: string }) {
  const [state, action] = useActionState<ActionState | null, FormData>(subscribeNewsletter, null);

  return (
    <div>
      <form action={action} className="flex">
        <input type="hidden" name="source" value={source} />
        <label htmlFor="newsletter-email" className="sr-only">
          Correo electrónico
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="tu@correo.cl"
          className="h-12 min-w-0 flex-1 border border-line bg-ink-800 px-4 text-[15px] text-chalk placeholder:text-chalk-faint/70 focus:border-[var(--accent)] focus:outline-none"
        />
        <Submit />
      </form>
      {state ? (
        <p
          role="status"
          className={`mt-2.5 text-[13px] ${state.ok ? 'text-signal-ok' : 'text-signal-bad'}`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
