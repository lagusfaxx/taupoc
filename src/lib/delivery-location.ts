import { z } from 'zod';

/** Solo localidad y código postal: nunca se guardan coordenadas ni la dirección de la vivienda. */
export const deliveryLocationSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(40),
  stateName: z.string().trim().max(100),
  postalCode: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Za-z0-9 -]*$/),
});
export type DeliveryLocation = z.infer<typeof deliveryLocationSchema>;

export interface MapboxPlace {
  id?: string;
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    feature_type?: string;
    context?: {
      country?: { name?: string; country_code?: string };
      region?: { name?: string; region_code?: string; region_code_full?: string };
      place?: { name?: string };
      locality?: { name?: string };
      postcode?: { name?: string };
    };
  };
}

export function mapboxLocation(feature: MapboxPlace): DeliveryLocation | null {
  const p = feature.properties;
  const c = p?.context;
  const country = c?.country?.country_code?.toUpperCase() ?? '';
  const city =
    c?.place?.name ||
    c?.locality?.name ||
    (['place', 'locality'].includes(p?.feature_type ?? '') ? p?.name : '') ||
    '';
  const parsed = deliveryLocationSchema.safeParse({
    country,
    countryName: c?.country?.name || country,
    city,
    state: c?.region?.region_code ?? c?.region?.region_code_full ?? '',
    stateName: c?.region?.name ?? '',
    postalCode: c?.postcode?.name || (p?.feature_type === 'postcode' ? p.name : '') || '',
  });
  return parsed.success ? parsed.data : null;
}

export function locationLabel(location: DeliveryLocation) {
  return `${location.city}, ${location.countryName}`;
}

export interface DeliveryEstimate {
  /** Texto real del plazo entregado por la paquetería a través de Envía. */
  days: string;
  carrier: string;
  service: string;
}

/** Evita presentar números, fechas o textos ajenos al plazo como días de entrega. */
export function deliveryDays(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = text.match(
    /^(\d{1,2})(?:\s*(?:[-–—]|a|to)\s*(\d{1,2}))?\s*(?:(?:días?|dias?)(?:\s+(hábiles|habiles|laborables|naturales))?|(?:business\s+)?days?)$/i,
  );
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  if (min < 1 || max < min || max > 90) return null;
  const business = /business|hábiles|habiles|laborables/i.test(text);
  return `${min === max ? min : `${min}–${max}`} ${max === 1 ? 'día' : 'días'}${business ? ' hábiles' : /naturales/i.test(text) ? ' naturales' : ''}`;
}
