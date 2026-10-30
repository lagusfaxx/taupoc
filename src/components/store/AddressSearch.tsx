'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/Field';

export interface PickedAddress {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  stateName: string;
}

interface Feature {
  id: string;
  geometry?: { coordinates?: [number, number] };
  properties: {
    full_address?: string;
    name?: string;
    context?: {
      address?: { address_number?: string; street_name?: string };
      street?: { name?: string };
      postcode?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      region?: { name?: string };
    };
  };
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Con token, el checkout muestra primero solo el buscador. */
export const ADDRESS_SEARCH_ENABLED = Boolean(TOKEN);

/**
 * Buscador de direcciones con Mapbox (Geocoding v6) para el comprador extranjero.
 * Al elegir una sugerencia rellena los campos de abajo, que siguen editables.
 *
 * Busca direcciones con número y también calles: en buena parte de
 * Latinoamérica Mapbox no tiene numeración (Ecuador, Bolivia, Centroamérica)
 * y solo direcciones no sugeriría nada. En otros países no tiene ni calles
 * (Venezuela, Paraguay); ahí avisa y abre los campos para escribirla.
 */
export function AddressSearch({
  country,
  onPick,
  onManual,
  onNoResults,
}: {
  country: string;
  onPick: (a: PickedAddress) => void;
  /** Si se pasa, muestra el enlace para escribir la dirección a mano. */
  onManual?: () => void;
  /** Mapbox no encontró nada para lo escrito: el formulario abre los campos. */
  onNoResults?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Feature[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [noResults, setNoResults] = useState(false);
  const skipNext = useRef(false);
  const onNoResultsRef = useRef(onNoResults);
  onNoResultsRef.current = onNoResults;

  useEffect(() => {
    setQuery('');
    setResults([]);
    setNoResults(false);
  }, [country]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = query.trim();
    if (!TOKEN || q.length < 4) {
      setResults([]);
      setNoResults(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        q,
        country: country.toLowerCase(),
        types: 'address,street',
        autocomplete: 'true',
        language: 'es',
        limit: '5',
        access_token: TOKEN,
      });
      try {
        const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { features?: Feature[] };
        const features = json.features ?? [];
        setResults(features);
        setActive(0);
        setOpen(true);
        setNoResults(features.length === 0);
        if (features.length === 0) onNoResultsRef.current?.(q);
      } catch {
        // Abortado o sin red: el comprador sigue con los campos manuales.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, country]);

  const pick = async (f: Feature) => {
    const ctx = f.properties.context ?? {};
    skipNext.current = true;
    setNoResults(false);
    setQuery(f.properties.full_address ?? f.properties.name ?? '');
    setOpen(false);
    // Muchas direcciones fuera de EE.UU. y Europa vienen sin código postal:
    // se busca el más cercano a la coordenada de la dirección elegida.
    const postalCode = ctx.postcode?.name || (await nearestPostcode(f));
    onPick({
      street: ctx.address?.street_name ?? ctx.street?.name ?? f.properties.name ?? '',
      number: ctx.address?.address_number ?? '',
      postalCode,
      city: ctx.place?.name ?? ctx.locality?.name ?? '',
      stateName: ctx.region?.name ?? '',
    });
  };

  const nearestPostcode = async (f: Feature): Promise<string> => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!TOKEN || lon == null || lat == null) return '';
    try {
      const params = new URLSearchParams({
        longitude: String(lon),
        latitude: String(lat),
        types: 'postcode',
        country: country.toLowerCase(),
        limit: '1',
        access_token: TOKEN,
      });
      const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
      if (!res.ok) return '';
      const json = (await res.json()) as { features?: Array<{ properties?: { name?: string } }> };
      return json.features?.[0]?.properties?.name ?? '';
    } catch {
      return '';
    }
  };

  if (!TOKEN) return null;

  return (
    <div className="relative sm:col-span-2">
      <Label htmlFor="address-search">Busca tu dirección</Label>
      <input
        id="address-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            void pick(results[active]);
          }
        }}
        placeholder="Calle y número, ej.: Av. José Larco 1200, Miraflores"
        autoComplete="off"
        className="w-full border border-line bg-ink-900 px-3.5 py-3 text-base text-chalk transition-colors sm:text-[15px] placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
      />
      <p className="mt-1.5 text-[13px] text-chalk-faint">
        {noResults
          ? 'No encontramos esa dirección en el mapa. Escríbela en los campos de abajo.'
          : 'Elige una sugerencia y completamos el resto.'}
        {onManual && !noResults ? (
          <>
            {' '}
            <button type="button" onClick={onManual} className="underline underline-offset-2 hover:text-chalk">
              ¿No aparece? Escríbela a mano
            </button>
          </>
        ) : null}
      </p>
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full border border-line-bright bg-ink-800 shadow-lg">
          {results.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(f)}
                className={cn(
                  'block w-full px-3.5 py-3 text-left text-[14px] text-chalk',
                  i === active ? 'bg-ink-700' : 'hover:bg-ink-700',
                )}
              >
                {f.properties.full_address ?? f.properties.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
