'use client';

import { useId, useState } from 'react';
import { applyIntlCoupon } from '@/actions/coupon-intl';
import type { IntlCartPricing } from '@/lib/intl-checkout';

/** Sin un form propio: también se usa dentro del formulario de pago. */
export function CouponEntry({
  pricing,
  email,
  disabled,
  onChange,
  onPending,
}: {
  pricing: IntlCartPricing;
  email?: string;
  disabled?: boolean;
  onChange: (pricing: IntlCartPricing) => void;
  onPending?: (pending: boolean) => void;
}) {
  const id = useId();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  async function apply(value: string) {
    if (pending || disabled) return;
    setPending(true);
    onPending?.(true);
    setMessage(null);
    try {
      const result = await applyIntlCoupon(value, email);
      setMessage(result.message);
      setFailed(!result.ok);
      if (result.ok && result.pricing) {
        onChange(result.pricing);
        setCode('');
      }
    } catch {
      setFailed(true);
      setMessage('No pudimos actualizar el cupón. Inténtalo de nuevo.');
    } finally {
      setPending(false);
      onPending?.(false);
    }
  }
  const savedCode = pricing.requestedCouponCode;
  return (
    <div className="border-t border-hairline py-5">
      {savedCode ? (
        <div className="flex items-center justify-between gap-3 text-[14px]">
          <span className="min-w-0 break-all">
            {' '}
            Cupón <strong className="font-medium">{savedCode}</strong>
          </span>
          <button
            type="button"
            disabled={pending || disabled}
            onClick={() => apply('')}
            className="shrink-0 text-graphite-soft underline underline-offset-4 disabled:opacity-50"
          >
            {pending ? 'Quitando…' : 'Quitar cupón'}
          </button>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="mb-2 block text-[14px] text-graphite-soft">
            Código de descuento
          </label>
          <div className="flex gap-2">
            <input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (code.trim()) void apply(code);
                }
              }}
              disabled={pending || disabled}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={100}
              placeholder="Ingresa tu cupón"
              className="h-12 min-w-0 flex-1 border border-hairline bg-paper px-3 text-[16px] uppercase text-graphite placeholder:normal-case placeholder:text-graphite-faint focus:border-graphite focus:outline-none"
            />
            <button
              type="button"
              disabled={pending || disabled || !code.trim()}
              onClick={() => apply(code)}
              className="h-12 border border-graphite px-4 text-[14px] text-graphite disabled:opacity-50"
            >
              {pending ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </>
      )}
      {pricing.couponError || message ? (
        <p
          role={pricing.couponError || failed ? 'alert' : 'status'}
          className="mt-2 break-words text-[13px] text-graphite-soft"
        >
          {pricing.couponError || message}
        </p>
      ) : null}
      {pricing.freeShipping ? (
        <p className="mt-2 text-[13px] text-graphite-soft">
          Envío gratis aplicado. Los impuestos de importación siguen por cuenta del comprador.
        </p>
      ) : null}
    </div>
  );
}
