'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createCheckout,
  fetchInternationalOptions,
  fetchShippingOptions,
  fetchStates,
  lookupZip,
  type CheckoutState,
} from '@/actions/checkout';
import type { EnviaCountry, EnviaState } from '@/lib/envia';
import type { ShippingOption } from '@/lib/shipping';
import type { CartSummary } from '@/lib/cart';
import { REGIONS, communesOf, formatRut } from '@/lib/chile';
import { formatCLP, installment } from '@/lib/money';
import { paymentMethodDiscount, type PaymentMethodId, type PaymentMethodOption } from '@/lib/payment-methods';
import { cn } from '@/lib/utils';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { AddressSearch, type PickedAddress } from '@/components/store/AddressSearch';
import { IconCheck, IconShield, IconTruck } from '@/components/ui/Icons';

function Submit({ total, disabled, method }: { total: number; disabled: boolean; method: PaymentMethodId | null }) {
  const { pending } = useFormStatus();
  const transfer = method === 'TRANSFER';
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-14 w-full accent-bg font-display text-[13px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-chalk-faint"
    >
      {pending
        ? transfer
          ? 'Registrando tu pedido…'
          : 'Conectando con Mercado Pago…'
        : transfer
          ? `Confirmar pedido · ${formatCLP(total)}`
          : `Pagar ${formatCLP(total)}`}
    </button>
  );
}

interface Props {
  cart: CartSummary;
  installmentsMax: number;
  paymentMethods: PaymentMethodOption[];
  /** Países extranjeros que cotiza Envía. Vacío si no está configurado: solo Chile. */
  countries: EnviaCountry[];
  defaults: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    rut: string;
    region: string;
    commune: string;
    street: string;
    streetNumber: string;
    addressExtra: string;
  };
}

export function CheckoutForm({ cart, installmentsMax, paymentMethods, countries, defaults }: Props) {
  const [state, action] = useActionState<CheckoutState | null, FormData>(createCheckout, null);

  const [region, setRegion] = useState(defaults.region);
  const [commune, setCommune] = useState(defaults.commune);
  const [rut, setRut] = useState(defaults.rut);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [rateId, setRateId] = useState('');
  const [loadingRates, startLoading] = useTransition();
  const [methodId, setMethodId] = useState<PaymentMethodId | null>(paymentMethods[0]?.id ?? null);

  // Chile es el valor por defecto: el comprador nacional no ve ningún paso extra.
  const [country, setCountry] = useState('CL');
  const international = country !== 'CL';
  const [states, setStates] = useState<EnviaState[]>([]);
  const [intl, setIntl] = useState({ state: '', city: '', postalCode: '', street: '', number: '' });
  const [quoted, setQuoted] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [zipStatus, setZipStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');

  const communes = useMemo(() => communesOf(region), [region]);

  const resetQuote = () => {
    setOptions([]);
    setRateId('');
    setQuoted(false);
    setQuoteError(null);
  };

  useEffect(() => {
    resetQuote();
    setCities([]);
    setZipStatus('idle');
    setIntl({ state: '', city: '', postalCode: '', street: '', number: '' });
    if (!international) return;
    setStates([]);
    fetchStates(country).then(setStates).catch(() => setStates([]));
  }, [country, international]);

  const updateIntl = (field: keyof typeof intl, value: string) => {
    setIntl((current) => ({ ...current, [field]: value }));
    // Cambió la dirección: la cotización anterior ya no vale.
    resetQuote();
  };

  // Lo elegido en el buscador rellena los campos; el código postal luego
  // pasa por Envía, que fija el estado con el código que espera para cotizar.
  const applyPicked = (a: PickedAddress) => {
    const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const state = states.find((st) => norm(st.name) === norm(a.stateName))?.code;
    setIntl((current) => ({
      state: state ?? current.state,
      city: a.city || current.city,
      postalCode: a.postalCode || current.postalCode,
      street: a.street || current.street,
      number: a.number || current.number,
    }));
    resetQuote();
  };

  // El código postal manda: con él Envía devuelve estado y ciudad, y el
  // comprador solo confirma en vez de adivinar cómo escribirlos.
  useEffect(() => {
    if (!international) return;
    const zip = intl.postalCode.trim();
    if (zip.length < 3) {
      setZipStatus('idle');
      setCities([]);
      return;
    }
    setZipStatus('loading');
    const timer = setTimeout(async () => {
      const match = await lookupZip(country, zip).catch(() => null);
      if (!match) {
        setZipStatus('missing');
        setCities([]);
        return;
      }
      setZipStatus('found');
      setCities(match.cities);
      // El catálogo de estados de Envía no siempre trae el que devuelve el código postal.
      if (match.state) {
        setStates((current) =>
          current.length === 0 || current.some((st) => st.code === match.state)
            ? current
            : [...current, { code: match.state, name: match.stateName }],
        );
      }
      setIntl((current) => ({
        ...current,
        state: match.state || current.state,
        city:
          match.cities.find((c) => c.toLowerCase() === current.city.trim().toLowerCase()) ??
          (current.city.trim() || (match.cities[0] ?? '')),
      }));
    }, 450);
    return () => clearTimeout(timer);
  }, [country, international, intl.postalCode]);

  // Con la dirección completa se cotiza sola, sin botón.
  const readyToQuote = Boolean(
    intl.city.trim() && intl.postalCode.trim() && intl.street.trim().length >= 3 && intl.number.trim(),
  );
  useEffect(() => {
    if (!international || !readyToQuote || zipStatus === 'loading') return;
    const timer = setTimeout(() => {
      startLoading(async () => {
        const result = await fetchInternationalOptions({
          country,
          state: intl.state,
          city: intl.city.trim(),
          postalCode: intl.postalCode.trim(),
          street: intl.street.trim(),
          number: intl.number.trim(),
        }).catch(() => ({ options: [], error: 'No pudimos cotizar. Intenta de nuevo en un momento.' }));
        setOptions(result.options);
        setRateId(result.options[0]?.rateId ?? '');
        setQuoteError(result.error);
        setQuoted(true);
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [international, readyToQuote, zipStatus, country, intl.state, intl.city, intl.postalCode, intl.street, intl.number]);

  // Las tarifas se recalculan en el servidor cada vez que cambia la región.
  useEffect(() => {
    if (international) return;
    startLoading(async () => {
      const result = await fetchShippingOptions(region || null);
      setOptions(result);
      setRateId((current) => (result.some((o) => o.rateId === current) ? current : (result[0]?.rateId ?? '')));
    });
  }, [region, international]);

  const selected = options.find((o) => o.rateId === rateId) ?? null;
  const shippingCost = cart.couponFreeShipping ? 0 : (selected?.price ?? 0);
  // Mismo cálculo que el servidor: el descuento del medio va sobre los
  // productos ya descontado el cupón, nunca sobre el despacho.
  const method = paymentMethods.find((m) => m.id === methodId) ?? null;
  const productsTotal = cart.subtotal - cart.discount;
  const methodDiscount = method ? paymentMethodDiscount(productsTotal, method.discountPercent) : 0;
  const total = Math.max(0, productsTotal - methodDiscount + shippingCost);
  const needsAddress = !international && (selected ? !selected.isPickup : true);
  const isTransfer = methodId === 'TRANSFER';

  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <div className="space-y-10">
        {state && !state.ok ? (
          <p role="alert" className="border border-signal-bad/40 bg-signal-bad/10 px-4 py-3 text-[14px] text-signal-bad">
            {state.message}
          </p>
        ) : null}

        {/* 1 · Contacto */}
        <section>
          <h2 className="mb-5 flex items-center gap-3 font-display text-[13px] uppercase tracking-widest text-chalk">
            <span className="flex h-6 w-6 items-center justify-center accent-bg text-[11px] font-bold">1</span>
            Datos de contacto
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              required
              defaultValue={defaults.email}
              error={errors.email}
              help="Ahí llega la confirmación y el seguimiento."
              className="sm:col-span-2"
            />
            <Input label="Nombre" name="firstName" required defaultValue={defaults.firstName} error={errors.firstName} />
            <Input label="Apellido" name="lastName" required defaultValue={defaults.lastName} error={errors.lastName} />
            <Input
              label="Teléfono"
              name="phone"
              type="tel"
              required
              placeholder="+56 9 1234 5678"
              defaultValue={defaults.phone}
              error={errors.phone}
            />
            <Input
              label="RUT"
              hint="opcional"
              name="rut"
              value={rut}
              onChange={(e) => setRut(formatRut(e.target.value))}
              placeholder="12.345.678-9"
              error={errors.rut}
              help="Solo si necesitas factura."
            />
          </div>
        </section>

        {/* 2 · Entrega */}
        <section>
          <h2 className="mb-5 flex items-center gap-3 font-display text-[13px] uppercase tracking-widest text-chalk">
            <span className="flex h-6 w-6 items-center justify-center accent-bg text-[11px] font-bold">2</span>
            Forma de entrega
          </h2>

          {countries.length > 0 ? (
            <Select
              label="País de destino"
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mb-5 max-w-sm"
            >
              <option value="CL">Chile</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          ) : (
            <input type="hidden" name="country" value="CL" />
          )}

          {international ? (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <AddressSearch country={country} onPick={applyPicked} />
              <Input
                label="Código postal"
                name="postalCode"
                value={intl.postalCode}
                onChange={(e) => updateIntl('postalCode', e.target.value)}
                error={errors.postalCode}
                autoComplete="postal-code"
                help={
                  zipStatus === 'loading'
                    ? 'Buscando…'
                    : zipStatus === 'found'
                      ? `✓ ${[intl.city, states.find((st) => st.code === intl.state)?.name].filter(Boolean).join(', ')}`
                      : zipStatus === 'missing'
                        ? 'No reconocemos ese código: completa ciudad y estado a mano.'
                        : 'Lo usamos para completar ciudad y estado.'
                }
              />
              {cities.length > 1 ? (
                <Select label="Ciudad" name="city" value={intl.city} onChange={(e) => updateIntl('city', e.target.value)} error={errors.city}>
                  {(intl.city && !cities.includes(intl.city) ? [intl.city, ...cities] : cities).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  label="Ciudad"
                  name="city"
                  value={intl.city}
                  onChange={(e) => updateIntl('city', e.target.value)}
                  error={errors.city}
                  autoComplete="address-level2"
                />
              )}
              {states.length > 0 ? (
                <Select
                  label="Estado / provincia"
                  name="state"
                  value={intl.state}
                  onChange={(e) => updateIntl('state', e.target.value)}
                  error={errors.state}
                >
                  <option value="">Selecciona</option>
                  {states.map((st) => (
                    <option key={st.code} value={st.code}>{st.name}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  label="Estado / provincia"
                  hint="opcional"
                  name="state"
                  value={intl.state}
                  onChange={(e) => updateIntl('state', e.target.value)}
                  autoComplete="address-level1"
                />
              )}
              <Input
                label="Calle"
                name="street"
                value={intl.street}
                onChange={(e) => updateIntl('street', e.target.value)}
                error={errors.street}
                autoComplete="address-line1"
              />
              <Input
                label="Número"
                name="streetNumber"
                value={intl.number}
                onChange={(e) => updateIntl('number', e.target.value)}
                error={errors.streetNumber}
              />
              <Input label="Depto. / referencia" hint="opcional" name="addressExtra" autoComplete="address-line2" />
            </div>
          ) : (
          <Select
            label="Región de destino"
            name="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCommune('');
            }}
            error={errors.region}
            className="mb-5 max-w-sm"
          >
            <option value="">Selecciona tu región</option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </Select>
          )}

          <input type="hidden" name="shippingRateId" value={rateId} />

          <div className={cn('space-y-2.5 transition-opacity', loadingRates && 'opacity-50')}>
            {loadingRates && international ? (
              <p className="border border-line bg-ink-900 px-4 py-3.5 text-[14px] text-chalk-faint">
                Cotizando con las paqueterías…
              </p>
            ) : null}
            {options.length === 0 && !loadingRates ? (
              <p className="border border-line bg-ink-900 px-4 py-3.5 text-[14px] text-chalk-faint">
                {!international
                  ? 'Selecciona tu región para ver las opciones de despacho disponibles.'
                  : quoted
                    ? (quoteError ?? 'No encontramos opciones de envío a esa dirección. Revisa los datos o escríbenos.')
                    : 'Completa tu dirección y te mostramos las paqueterías disponibles con su precio.'}
              </p>
            ) : null}

            {options.map((option) => {
              const active = option.rateId === rateId;
              const price = cart.couponFreeShipping ? 0 : option.price;
              return (
                <label
                  key={option.rateId}
                  className={cn(
                    'flex cursor-pointer items-start gap-3.5 border px-4 py-3.5 transition-colors',
                    active ? 'accent-border bg-ink-800' : 'border-line hover:border-line-bright',
                  )}
                >
                  <input
                    type="radio"
                    name="_rate"
                    checked={active}
                    onChange={() => setRateId(option.rateId)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-display text-[13px] font-semibold uppercase tracking-wide text-chalk">
                        {option.label}
                      </span>
                      <span className={cn('font-display text-[14px] font-semibold', price === 0 ? 'text-signal-ok' : 'text-chalk')}>
                        {price === 0 ? 'Gratis' : formatCLP(price)}
                      </span>
                    </span>
                    <span className="mt-1 block text-[12.5px] text-chalk-faint">
                      {option.carrier}
                      {option.etaMaxDays > 0 ? ` · ${option.etaMinDays}–${option.etaMaxDays} días hábiles` : ''}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block text-[12.5px] text-chalk-faint">{option.description}</span>
                    ) : null}
                    {option.freeApplied ? (
                      <span className="mt-1.5 inline-block border border-signal-ok/40 bg-signal-ok/10 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-signal-ok">
                        Envío gratis aplicado
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          {selected?.isPickup && selected.pickupInfo ? (
            <p className="mt-4 border-l-2 accent-border bg-ink-900 px-4 py-3 text-[13.5px] leading-relaxed text-chalk-dim">
              {selected.pickupInfo}
            </p>
          ) : null}
        </section>

        {/* 3 · Dirección */}
        {needsAddress ? (
          <section>
            <h2 className="mb-5 flex items-center gap-3 font-display text-[13px] uppercase tracking-widest text-chalk">
              <span className="flex h-6 w-6 items-center justify-center accent-bg text-[11px] font-bold">3</span>
              Dirección de despacho
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Comuna"
                name="commune"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                error={errors.commune}
                disabled={!region}
              >
                <option value="">{region ? 'Selecciona tu comuna' : 'Elige primero la región'}</option>
                {communes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input label="Código postal" hint="opcional" name="postalCode" />
              <Input label="Calle" name="street" defaultValue={defaults.street} error={errors.street} className="sm:col-span-2" />
              <Input label="Número" name="streetNumber" defaultValue={defaults.streetNumber} error={errors.streetNumber} />
              <Input
                label="Depto. / casa / referencia"
                hint="opcional"
                name="addressExtra"
                defaultValue={defaults.addressExtra}
              />
            </div>
          </section>
        ) : null}

        {/* Medio de pago */}
        <section>
          <h2 className="mb-5 flex items-center gap-3 font-display text-[13px] uppercase tracking-widest text-chalk">
            <span className="flex h-6 w-6 items-center justify-center accent-bg text-[11px] font-bold">
              {needsAddress ? 4 : 3}
            </span>
            Medio de pago
          </h2>

          <input type="hidden" name="paymentMethod" value={methodId ?? ''} />

          <div className="space-y-2.5">
            {paymentMethods.map((option) => {
              const active = option.id === methodId;
              const saving = paymentMethodDiscount(productsTotal, option.discountPercent);
              return (
                <label
                  key={option.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3.5 border px-4 py-3.5 transition-colors',
                    active ? 'accent-border bg-ink-800' : 'border-line hover:border-line-bright',
                  )}
                >
                  <input
                    type="radio"
                    name="_method"
                    checked={active}
                    onChange={() => setMethodId(option.id)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-display text-[13px] font-semibold uppercase tracking-wide text-chalk">
                        {option.label}
                      </span>
                      {option.discountPercent > 0 ? (
                        <span className="border border-signal-ok/40 bg-signal-ok/10 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-signal-ok">
                          {option.discountPercent}% de descuento
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-chalk-faint">
                      {option.id === 'TRANSFER'
                        ? 'Te mostramos los datos de la cuenta al confirmar. Despachamos cuando verificamos el abono.'
                        : 'Crédito, débito y cuotas. Te redirigimos a Mercado Pago para pagar.'}
                    </span>
                    {saving > 0 ? (
                      <span className="mt-0.5 block text-[12.5px] text-signal-ok">Ahorras {formatCLP(saving)}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.paymentMethod ? (
            <p className="mt-2 text-[12.5px] text-signal-bad">{errors.paymentMethod}</p>
          ) : null}
        </section>

        <section>
          <Textarea
            label="Nota para el pedido"
            hint="opcional"
            name="customerNote"
            rows={3}
            placeholder="Ej.: entregar en el torneo de Viña del 12 de octubre."
          />
        </section>
      </div>

      {/* Resumen */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface p-6">
          <h2 className="font-display text-[13px] uppercase tracking-widest text-chalk">Tu pedido</h2>

          <ul className="mt-5 space-y-3.5 border-b border-line pb-5">
            {cart.lines.map((line) => (
              <li key={line.itemId} className="flex justify-between gap-4 text-[13.5px]">
                <span className="min-w-0">
                  <span className="block truncate text-chalk">{line.productName}</span>
                  <span className="block text-chalk-faint">
                    {line.colorName} · T{line.size} · {line.quantity} u.
                  </span>
                </span>
                <span className="shrink-0 text-chalk">{formatCLP(line.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-chalk-faint">Subtotal</dt>
              <dd className="text-chalk">{formatCLP(cart.subtotal)}</dd>
            </div>
            {cart.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Descuento {cart.couponCode ? `(${cart.couponCode})` : ''}</dt>
                <dd className="text-signal-ok">−{formatCLP(cart.discount)}</dd>
              </div>
            ) : null}
            {method && methodDiscount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Descuento {method.label.toLowerCase()} ({method.discountPercent}%)</dt>
                <dd className="text-signal-ok">−{formatCLP(methodDiscount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-chalk-faint">Despacho</dt>
              <dd className={shippingCost === 0 && selected ? 'text-signal-ok' : 'text-chalk'}>
                {!selected ? '—' : shippingCost === 0 ? 'Gratis' : formatCLP(shippingCost)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
            <span className="font-display text-[13px] uppercase tracking-widest text-chalk">Total</span>
            <span className="font-display text-[26px] font-bold tracking-tight accent-text">
              {formatCLP(total)}
            </span>
          </div>

          {installmentsMax > 1 && !isTransfer ? (
            <p className="mt-2 text-right text-[12.5px] text-chalk-faint">
              o {installmentsMax} cuotas de {formatCLP(installment(total, installmentsMax))}
            </p>
          ) : null}

          <div className="mt-6">
            <Submit total={total} method={methodId} disabled={!rateId || !methodId || cart.hasIssues} />
          </div>

          <ul className="mt-6 space-y-3 border-t border-line pt-5">
            <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0" />
              {isTransfer
                ? 'Al confirmar te mostramos los datos para transferir y te los enviamos por correo.'
                : 'Te redirigimos a Mercado Pago para completar el pago. No guardamos datos de tu tarjeta.'}
            </li>
            <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
              <IconTruck className="mt-0.5 h-4 w-4 shrink-0" />
              Despachamos el mismo día hábil una vez acreditado el pago.
            </li>
            <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Cambio de talla sin costo dentro de 10 días.
            </li>
          </ul>
        </div>
      </aside>
    </form>
  );
}
