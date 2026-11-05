'use client';

import { useEffect, useRef, useState } from 'react';
import { IconClose, IconLocation } from '@/components/ui/Icons';
import {
  deliveryLocationSchema,
  locationLabel,
  type DeliveryLocation,
} from '@/lib/delivery-location';
import { LOCATION_SEARCH_ENABLED, searchDelivery } from '@/lib/mapbox-location';
import { useDelivery } from './DeliveryProvider';

const EMPTY: DeliveryLocation = {
  country: '',
  countryName: '',
  city: '',
  state: '',
  stateName: '',
  postalCode: '',
};
const FIELD =
  'mt-1.5 h-12 w-full border border-hairline bg-paper px-3 text-[16px] text-graphite focus:border-graphite focus:outline-none';

function LocationEditor() {
  const { location, choose, locate, locating, message, setOpen } = useDelivery();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(location ?? EMPTY);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchDelivery>>>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch('/api/intl/entrega', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((r) => setCountries(r.countries ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (!LOCATION_SEARCH_ENABLED || query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchDelivery(query.trim(), draft.country, controller.signal);
        if (!active) return;
        setResults(found);
        setActive(0);
        setError(found.length ? '' : 'No encontramos esa localidad. Puedes escribirla abajo.');
      } catch {
        if (active) setError('Puedes completar tu localidad en los campos de abajo.');
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, draft.country]);

  function pick(index: number) {
    const found = results[index];
    if (!found) return;
    skip.current = true;
    setDraft(found.location);
    setQuery(found.label);
    setResults([]);
    setError('');
  }

  return (
    <dialog
      ref={dialog}
      onCancel={() => setOpen(false)}
      onClose={() => setOpen(false)}
      aria-labelledby="delivery-location-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border border-hairline bg-paper p-6 text-graphite backdrop:bg-black/30"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="delivery-location-title" className="text-[24px]">
          Tu localidad
        </h2>
        <button
          type="button"
          aria-label="Cerrar localidad"
          onClick={() => setOpen(false)}
          className="p-2"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 text-[14px] text-graphite-soft">
        La usamos para estimar el envío. Confirmarás tu dirección al pagar.
      </p>
      {LOCATION_SEARCH_ENABLED ? (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-4 min-h-11 text-[14px] underline underline-offset-4 disabled:opacity-50"
        >
          {locating ? 'Buscando tu localidad…' : 'Usar mi ubicación'}
        </button>
      ) : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = deliveryLocationSchema.safeParse(draft);
          if (!parsed.success || draft.postalCode.trim().length < 2) {
            setError('Completa país, localidad y código postal.');
            return;
          }
          choose(parsed.data);
        }}
      >
        {LOCATION_SEARCH_ENABLED ? (
          <div>
            <label htmlFor="delivery-search" className="text-[13px] text-graphite-soft">
              Buscar localidad
            </label>
            <input
              id="delivery-search"
              className={FIELD}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Por ejemplo, Ciudad de Panamá"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls="delivery-results"
              aria-activedescendant={results.length ? `delivery-result-${active}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  pick(active);
                }
                if (!results.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => (i + 1) % results.length);
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => (i - 1 + results.length) % results.length);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setResults([]);
                }
              }}
            />
            {searching ? <p className="mt-1 text-[13px] text-graphite-soft">Buscando…</p> : null}
            {results.length ? (
              <ul
                id="delivery-results"
                role="listbox"
                className="border-x border-b border-hairline"
              >
                {results.map((r, i) => (
                  <li
                    key={`${r.label}-${i}`}
                    id={`delivery-result-${i}`}
                    role="option"
                    aria-selected={i === active}
                  >
                    <button
                      type="button"
                      onClick={() => pick(i)}
                      className={`w-full px-3 py-3 text-left text-[14px] ${active === i ? 'bg-paper-soft' : ''}`}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div>
          <label htmlFor="delivery-country" className="block text-[13px] text-graphite-soft">
            País
          </label>
          <select
            id="delivery-country"
            className={FIELD}
            required
            value={draft.country}
            onChange={(e) => {
              const code = e.target.value;
              setDraft({
                ...EMPTY,
                country: code,
                countryName: countries.find((c) => c.code === code)?.name ?? code,
              });
              setQuery('');
              setResults([]);
            }}
          >
            <option value="">Elige tu país</option>
            {draft.country && !countries.some((c) => c.code === draft.country) ? (
              <option value={draft.country}>{draft.countryName}</option>
            ) : null}
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="block text-[13px] text-graphite-soft">
          Ciudad o localidad
          <input
            className={FIELD}
            required
            maxLength={120}
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
          />
        </label>
        <label className="block text-[13px] text-graphite-soft">
          Provincia o estado <span>(opcional)</span>
          <input
            className={FIELD}
            maxLength={100}
            value={draft.stateName}
            onChange={(e) => setDraft({ ...draft, stateName: e.target.value, state: '' })}
          />
        </label>
        <label className="block text-[13px] text-graphite-soft">
          Código postal
          <input
            className={FIELD}
            required
            minLength={2}
            maxLength={12}
            autoComplete="postal-code"
            value={draft.postalCode}
            onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
          />
        </label>
        {error || message ? (
          <p role="status" className="text-[13px] text-graphite-soft">
            {error || message}
          </p>
        ) : null}
        <button
          type="submit"
          className="h-12 w-full bg-cobalt text-[15px] text-white hover:bg-cobalt-hover"
        >
          Guardar localidad
        </button>
      </form>
    </dialog>
  );
}

export function DeliveryLocationControl() {
  const { location, locating, message, open, setOpen } = useDelivery();
  return (
    <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 py-2 text-[13px] text-graphite-soft sm:px-8">
      <IconLocation className="h-4 w-4 shrink-0" />
      <p role="status" className="min-w-0">
        {locating
          ? 'Buscando tu localidad…'
          : location
            ? `Envíos a ${locationLabel(location)}`
            : message || 'Consulta los plazos de envío a tu localidad'}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto min-h-10 shrink-0 underline underline-offset-4"
      >
        {location
          ? location.postalCode || location.country === 'CL'
            ? 'Cambiar'
            : 'Completar'
          : 'Elegir localidad'}
      </button>
      {open ? <LocationEditor /> : null}
    </div>
  );
}
