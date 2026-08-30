'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { applyCoupon, type CartActionState } from '@/actions/cart';
import { IconClose, IconTag } from '@/components/ui/Icons';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 shrink-0 border border-line-bright px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk transition-colors hover:border-chalk disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  );
}

export function CouponForm({ appliedCode, error }: { appliedCode: string | null; error?: string | null }) {
  const [state, action] = useActionState<CartActionState | null, FormData>(applyCoupon, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (appliedCode) {
    return (
      <form action={action} className="flex items-center justify-between gap-3 border accent-border bg-ink-800 px-3.5 py-3">
        <input type="hidden" name="code" value="" />
        <span className="inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-widest accent-text">
          <IconTag className="h-4 w-4" />
          {appliedCode}
        </span>
        <button type="submit" aria-label="Quitar cupón" className="text-chalk-faint hover:text-chalk">
          <IconClose className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <div>
      <form action={action} className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">Código de descuento</label>
        <input
          id="coupon"
          name="code"
          placeholder="Código de descuento"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 border border-line bg-ink-900 px-3.5 text-[14px] uppercase text-chalk placeholder:normal-case placeholder:text-chalk-faint/70 focus:border-[var(--accent)] focus:outline-none"
        />
        <Submit label="Aplicar" />
      </form>
      {state && !state.ok ? (
        <p role="alert" className="mt-2 text-[12.5px] text-signal-bad">{state.message}</p>
      ) : error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-signal-bad">{error}</p>
      ) : null}
    </div>
  );
}
