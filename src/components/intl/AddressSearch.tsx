'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
export const ADDRESS_SEARCH_ENABLED = Boolean(TOKEN);

/**
 * Buscador de direcciones del checkout de taupoc.lat (Mapbox Geocoding v6).
 * Al elegir una sugerencia completa los campos, que siguen editables.
 *
 * Busca direcciones con número y también calles: en buena parte de
 * Latinoamérica Mapbox no tiene numeración. Donde no tiene ni calles
 * (Venezuela, Paraguay) avisa y la persona escribe la dirección a mano; un
 * Plus Code de Google Maps se entrega para guardarlo como referencia.
 */
export function AddressSearch({
  country,
  onPick,
  onNoResults,
}: {
  country: string;
  onPick: (a: PickedAddress) => void;
  onNoResults?: (query: string, plusCode: string | null) => void;
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
    if (!TOKEN || !country || q.length < 4) {
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
        const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        const features = ((await res.json()) as { features?: Feature[] }).features ?? [];
        setResults(features);
        setActive(0);
        setOpen(true);
        setNoResults(features.length === 0);
        if (features.length === 0) {
          const plus = q.match(/\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i)?.[0] ?? null;
          onNoResultsRef.current?.(q, plus ? plus.toUpperCase() : null);
        }
      } catch {
        // Abortado o sin red: la persona sigue con los campos.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, country]);

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

  const pick = async (f: Feature) => {
    const ctx = f.properties.context ?? {};
    skipNext.current = true;
    setNoResults(false);
    setQuery(f.properties.full_address ?? f.properties.name ?? '');
    setOpen(false);
    // Muchas direcciones de la región vienen sin código postal: se busca el
    // más cercano a la dirección elegida.
    const postalCode = ctx.postcode?.name || (await nearestPostcode(f));
    onPick({
      street: ctx.address?.street_name ?? ctx.street?.name ?? f.properties.name ?? '',
      number: ctx.address?.address_number ?? '',
      postalCode,
      city: ctx.place?.name ?? ctx.locality?.name ?? '',
      stateName: ctx.region?.name ?? '',
    });
  };

  if (!TOKEN || !country) return null;

  return (
    <div className="relative">
      <label htmlFor="address-search" className="mb-1.5 block text-[13px] text-graphite-soft">
        Busca tu dirección
      </label>
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
        placeholder="Calle y número, ciudad"
        autoComplete="off"
        className="h-12 w-full border border-hairline bg-paper px-3.5 text-[16px] text-graphite placeholder:text-graphite-faint focus:border-graphite focus:outline-none"
      />
      <p className="mt-1.5 text-[13px] text-graphite-soft">
        {noResults
          ? 'No encontramos esa dirección en el mapa. Escríbela en los campos de abajo.'
          : 'Elige una sugerencia y completamos el resto, o escribe la dirección abajo.'}
      </p>
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full border border-hairline bg-paper">
          {results.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(f)}
                className={cn('block w-full px-3.5 py-3 text-left text-[15px] text-graphite', i === active ? 'bg-paper-soft' : 'hover:bg-paper-soft')}
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
