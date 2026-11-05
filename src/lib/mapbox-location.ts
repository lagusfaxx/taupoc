import { mapboxLocation, type DeliveryLocation, type MapboxPlace } from './delivery-location';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
export const LOCATION_SEARCH_ENABLED = Boolean(TOKEN);

async function geocode(
  kind: 'forward' | 'reverse',
  params: Record<string, string>,
  signal: AbortSignal,
) {
  if (!TOKEN) return [];
  const query = new URLSearchParams({ ...params, language: 'es', access_token: TOKEN });
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/${kind}?${query}`, {
    signal,
  });
  if (!response.ok) throw new Error('No pudimos consultar la ubicación.');
  const data = (await response.json()) as { features?: MapboxPlace[] };
  return data.features ?? [];
}

export async function locateDelivery(
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<DeliveryLocation | null> {
  const features = await geocode(
    'reverse',
    { latitude: String(latitude), longitude: String(longitude) },
    signal,
  );
  const locations = features.map(mapboxLocation).filter((l): l is DeliveryLocation => l !== null);
  return locations.find((l) => l.postalCode) ?? locations[0] ?? null;
}

export async function searchDelivery(query: string, country: string, signal: AbortSignal) {
  const features = await geocode(
    'forward',
    {
      q: query,
      types: 'place,locality,postcode',
      autocomplete: 'true',
      limit: '5',
      proximity: 'ip',
      ...(country ? { country: country.toLowerCase() } : {}),
    },
    signal,
  );
  return features.flatMap((feature) => {
    const location = mapboxLocation(feature);
    return location
      ? [
          {
            location,
            label:
              feature.properties?.full_address ||
              `${location.city}, ${location.stateName}, ${location.countryName}`,
          },
        ]
      : [];
  });
}
