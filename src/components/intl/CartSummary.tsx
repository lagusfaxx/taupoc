'use client';

import { useEffect, useState } from 'react';
import { formatUsdCents } from '@/lib/fx';
import { intlTotal, type IntlCartPricing } from '@/lib/intl-checkout';
import { CouponEntry } from './CouponEntry';

export function IntlCartSummary({
  pricing: initialPricing,
  hasIssues,
}: {
  pricing: IntlCartPricing;
  hasIssues: boolean;
}) {
  const [pricing, setPricing] = useState(initialPricing);
  const [pending, setPending] = useState(false);
  useEffect(() => setPricing(initialPricing), [initialPricing]);
  return (
    <div className="text-[16px]">
      <CouponEntry pricing={pricing} onChange={setPricing} onPending={setPending} />
      <dl className="space-y-3 border-t border-hairline pt-5">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatUsdCents(pricing.subtotalCents)}</dd>
        </div>
        {pricing.discountCents > 0 ? (
          <div className="flex justify-between">
            <dt>Descuento</dt>
            <dd>−{formatUsdCents(pricing.discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between font-medium">
          <dt>Total sin envío</dt>
          <dd>{formatUsdCents(intlTotal(pricing).totalCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[14px] text-graphite-soft">
        {pricing.freeShipping
          ? 'Tu cupón cubre el envío. Elige la entrega en el siguiente paso.'
          : 'El envío se calcula con tu dirección en el siguiente paso.'}{' '}
        Precios en dólares.
      </p>
      {hasIssues ? (
        <p className="mt-6 text-[15px] text-graphite">Ajusta las cantidades para continuar.</p>
      ) : (
        <a
          href="/checkout"
          aria-disabled={pending}
          onClick={(e) => {
            if (pending) e.preventDefault();
          }}
          className="mt-6 flex h-14 items-center justify-center bg-cobalt text-[16px] font-medium text-white transition-colors hover:bg-cobalt-hover aria-disabled:opacity-50"
        >
          Continuar al pago
        </a>
      )}
    </div>
  );
}
