'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  intlShippingOptions,
  intlStates,
  intlZip,
  placeIntlOrder,
  type IntlCheckoutState,
  type IntlShippingOption,
} from '@/actions/checkout-intl';
import { formatUsdCents } from '@/lib/fx';
import { taxIdRule } from '@/lib/intl-checkout';
import { cn } from '@/lib/utils';

interface Line {
  itemId: string;
  name: string;
  detail: string;
  quantity: number;
  lineCents: number;
}

const FIELD =
  'h-12 w-full border border-hairline bg-paper px-3.5 text-[16px] text-graphite placeholder:text-graphite-faint focus:border-graphite focus:outline-none';

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-[13px] text-graphite-soft">
        {label}
        {hint ? <span>{hint}</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-[13px] text-graphite">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function IntlCheckoutForm({
  lines,
  subtotalCents,
  countries,
}: {
  lines: Line[];
  subtotalCents: number;
  countries: { code: string; name: string }[];
}) {
  const [addr, setAddr] = useState({ country: '', state: '', city: '', postalCode: '', street: '', streetNumber: '' });
  const [states, setStates] = useState<{ code: string; name: string }[]>([]);
  const [options, setOptions] = useState<IntlShippingOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [rateId, setRateId] = useState('');
  const [state, setState] = useState<IntlCheckoutState | null>(null);
  const [pending, start] = useTransition();
  const errors = state?.fieldErrors ?? {};
  const tax = taxIdRule(addr.country);
  const set = (k: keyof typeof addr) => (e: { target: { value: string } }) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  // Estados del país elegido.
  useEffect(() => {
    setStates([]);
    setAddr((a) => ({ ...a, state: '' }));
    if (addr.country) intlStates(addr.country).then(setStates).catch(() => setStates([]));
  }, [addr.country]);

  // El código postal completa estado y ciudad cuando Envía lo conoce.
  useEffect(() => {
    if (!addr.country || addr.postalCode.trim().length < 3) return;
    const t = setTimeout(() => {
      intlZip(addr.country, addr.postalCode.trim())
        .then((m) => {
          if (!m) return;
          setAddr((a) => ({ ...a, state: a.state || m.state, city: a.city || m.cities[0] || '' }));
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [addr.country, addr.postalCode]);

  // Cotización en vivo con Envía cuando la dirección está completa.
  const ready = Boolean(addr.country && addr.city.trim() && addr.postalCode.trim());
  const key = JSON.stringify(addr);
  useEffect(() => {
    setOptions([]);
    setRateId('');
    setQuoteError(null);
    if (!ready) return;
    const t = setTimeout(() => {
      setQuoting(true);
      intlShippingOptions({ ...addr, number: addr.streetNumber })
        .then((r) => {
          setOptions(r.options);
          setRateId(r.options[0]?.rateId ?? '');
          setQuoteError(r.options.length === 0 ? (r.error ?? 'No hay envíos disponibles para esta dirección.') : null);
        })
        .catch(() => setQuoteError('No pudimos cotizar el envío. Revisa la dirección e inténtalo de nuevo.'))
        .finally(() => setQuoting(false));
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const shipping = options.find((o) => o.rateId === rateId) ?? null;
  const total = useMemo(() => subtotalCents + (shipping?.cents ?? 0), [subtotalCents, shipping]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await placeIntlOrder(null, fd);
      setState(r);
      // Carga completa hacia PayPal: no depende del router de la tienda.
      if (r.ok && r.redirectTo) window.location.assign(r.redirectTo);
    });
  }

  return (
    <form onSubmit={submit} className="mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
      <div className="space-y-12">
        <fieldset className="space-y-4">
          <legend className="mb-5 font-editorial text-[24px] font-semibold tracking-tight">Contacto</legend>
          <Field label="Correo" error={errors.email}>
            <input name="email" type="email" autoComplete="email" className={FIELD} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" error={errors.firstName}>
              <input name="firstName" autoComplete="given-name" className={FIELD} />
            </Field>
            <Field label="Apellido" error={errors.lastName}>
              <input name="lastName" autoComplete="family-name" className={FIELD} />
            </Field>
          </div>
          <Field label="Teléfono" hint="con código de país" error={errors.phone}>
            <input name="phone" type="tel" autoComplete="tel" placeholder="+52 55 1234 5678" className={FIELD} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-5 font-editorial text-[24px] font-semibold tracking-tight">Dirección de envío</legend>
          <Field label="País" error={errors.country}>
            <select name="country" value={addr.country} onChange={set('country')} className={FIELD}>
              <option value="">Elige tu país</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código postal" error={errors.postalCode}>
              <input name="postalCode" value={addr.postalCode} onChange={set('postalCode')} autoComplete="postal-code" className={FIELD} />
            </Field>
            <Field label="Ciudad" error={errors.city}>
              <input name="city" value={addr.city} onChange={set('city')} autoComplete="address-level2" className={FIELD} />
            </Field>
          </div>
          <Field label="Estado / provincia" hint={states.length ? undefined : 'opcional'} error={errors.state}>
            {states.length ? (
              <select name="state" value={addr.state} onChange={set('state')} className={FIELD}>
                <option value="">Elige</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input name="state" value={addr.state} onChange={set('state')} autoComplete="address-level1" className={FIELD} />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Calle" error={errors.street}>
              <input name="street" value={addr.street} onChange={set('street')} autoComplete="address-line1" className={FIELD} />
            </Field>
            <Field label="Número" error={errors.streetNumber}>
              <input name="streetNumber" value={addr.streetNumber} onChange={set('streetNumber')} className={FIELD} />
            </Field>
          </div>
          <Field label="Depto., casa o referencia" hint="opcional">
            <input name="addressExtra" autoComplete="address-line2" className={FIELD} />
          </Field>
          {addr.country ? (
            <Field label={tax.label} hint={tax.required ? 'lo pide la aduana' : 'opcional'} error={errors.taxId}>
              <input name="taxId" className={FIELD} />
            </Field>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="mb-5 font-editorial text-[24px] font-semibold tracking-tight">Envío</legend>
          <input type="hidden" name="shippingRateId" value={rateId} />
          {!ready ? (
            <p className="text-[15px] text-graphite-soft">Completa país, código postal y ciudad para ver las opciones.</p>
          ) : quoting ? (
            <p className="text-[15px] text-graphite-soft">Cotizando con las paqueterías…</p>
          ) : quoteError ? (
            <p role="alert" className="text-[15px] text-graphite">
              {quoteError}
            </p>
          ) : (
            <ul className="divide-y divide-hairline border-y border-hairline">
              {options.map((o) => (
                <li key={o.rateId}>
                  <label className="flex cursor-pointer items-center gap-4 py-4 text-[16px]">
                    <input
                      type="radio"
                      name="_rate"
                      checked={rateId === o.rateId}
                      onChange={() => setRateId(o.rateId)}
                      className="h-4 w-4 accent-[#1a3cff]"
                    />
                    <span className="flex-1">
                      {o.carrier} · {o.label}
                      {o.estimate ? <span className="block text-[14px] text-graphite-soft">{o.estimate}</span> : null}
                    </span>
                    <span>{formatUsdCents(o.cents)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {errors.shippingRateId ? (
            <p role="alert" className="mt-2 text-[13px] text-graphite">
              {errors.shippingRateId}
            </p>
          ) : null}
        </fieldset>

        <Field label="Nota para el pedido" hint="opcional">
          <textarea name="customerNote" rows={2} className={cn(FIELD, 'h-auto py-3')} />
        </Field>
      </div>

      <aside className="mt-12 lg:mt-0">
        <div className="lg:sticky lg:top-8">
          <h2 className="font-editorial text-[24px] font-semibold tracking-tight">Tu pedido</h2>
          <ul className="mt-5 space-y-3 text-[15px]">
            {lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-4">
                <span>
                  {l.name}
                  <span className="block text-graphite-soft">
                    {l.detail} · {l.quantity} u.
                  </span>
                </span>
                <span className="shrink-0">{formatUsdCents(l.lineCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-hairline pt-5 text-[15px]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatUsdCents(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Envío</dt>
              <dd>{shipping ? formatUsdCents(shipping.cents) : '—'}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-3 text-[18px] font-medium">
              <dt>Total</dt>
              <dd>{formatUsdCents(total)}</dd>
            </div>
          </dl>

          <div className="mt-6 bg-paper-soft p-4 text-[14px] leading-relaxed text-graphite">
            <p>
              Los impuestos y derechos de importación de tu país no están incluidos. Si corresponden, los cobra la
              aduana o la paquetería al entregar.
            </p>
            <label className="mt-3 flex items-start gap-3">
              <input type="checkbox" name="duties" className="mt-1 h-4 w-4 accent-[#1a3cff]" />
              <span>Entiendo que los impuestos de importación son por mi cuenta.</span>
            </label>
            {errors.duties ? (
              <p role="alert" className="mt-2 text-[13px]">
                {errors.duties}
              </p>
            ) : null}
          </div>

          {state && !state.ok ? (
            <p role="alert" className="mt-5 text-[15px] text-graphite">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || !shipping}
            className="mt-6 h-14 w-full bg-cobalt text-[16px] font-medium text-white transition-colors hover:bg-cobalt-hover disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-graphite-faint"
          >
            {pending ? 'Conectando con PayPal…' : `Pagar ${formatUsdCents(total)} con PayPal`}
          </button>
          <p className="mt-3 text-[13px] text-graphite-soft">
            Pagas con tu cuenta PayPal o con tarjeta de crédito o débito. Despachamos desde Santiago con número de
            seguimiento.
          </p>
        </div>
      </aside>
    </form>
  );
}
