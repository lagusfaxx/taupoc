'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { createCheckout, fetchShippingOptions, type CheckoutState } from '@/actions/checkout';
import type { ShippingOption } from '@/lib/shipping';
import type { CartSummary } from '@/lib/cart';
import { REGIONS, communesOf, formatRut } from '@/lib/chile';
import { formatCLP, installment } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { IconCheck, IconShield, IconTruck } from '@/components/ui/Icons';

function Submit({ total, disabled }: { total: number; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-14 w-full accent-bg font-display text-[13px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-chalk-faint"
    >
      {pending ? 'Conectando con Mercado Pago…' : `Pagar ${formatCLP(total)}`}
    </button>
  );
}

interface Props {
  cart: CartSummary;
  installmentsMax: number;
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

export function CheckoutForm({ cart, installmentsMax, defaults }: Props) {
  const [state, action] = useActionState<CheckoutState | null, FormData>(createCheckout, null);

  const [region, setRegion] = useState(defaults.region);
  const [commune, setCommune] = useState(defaults.commune);
  const [rut, setRut] = useState(defaults.rut);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [rateId, setRateId] = useState('');
  const [loadingRates, startLoading] = useTransition();

  const communes = useMemo(() => communesOf(region), [region]);

  // Las tarifas se recalculan en el servidor cada vez que cambia la región.
  useEffect(() => {
    startLoading(async () => {
      const result = await fetchShippingOptions(region || null);
      setOptions(result);
      setRateId((current) => (result.some((o) => o.rateId === current) ? current : (result[0]?.rateId ?? '')));
    });
  }, [region]);

  const selected = options.find((o) => o.rateId === rateId) ?? null;
  const shippingCost = cart.couponFreeShipping ? 0 : (selected?.price ?? 0);
  const total = Math.max(0, cart.subtotal - cart.discount + shippingCost);
  const needsAddress = selected ? !selected.isPickup : true;

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

          <input type="hidden" name="shippingRateId" value={rateId} />

          <div className={cn('space-y-2.5 transition-opacity', loadingRates && 'opacity-50')}>
            {options.length === 0 && !loadingRates ? (
              <p className="border border-line bg-ink-900 px-4 py-3.5 text-[14px] text-chalk-faint">
                Selecciona tu región para ver las opciones de despacho disponibles.
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
                      {option.carrier} · {option.etaMinDays}–{option.etaMaxDays} días hábiles
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

          {installmentsMax > 1 ? (
            <p className="mt-2 text-right text-[12.5px] text-chalk-faint">
              o {installmentsMax} cuotas de {formatCLP(installment(total, installmentsMax))}
            </p>
          ) : null}

          <div className="mt-6">
            <Submit total={total} disabled={!rateId || cart.hasIssues} />
          </div>

          <ul className="mt-6 space-y-3 border-t border-line pt-5">
            <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0" />
              Te redirigimos a Mercado Pago para completar el pago. No guardamos datos de tu tarjeta.
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
