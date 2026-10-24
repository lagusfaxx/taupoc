import 'server-only';

/**
 * Cliente de la API de Envía (envia.com) para los despachos internacionales.
 * Los envíos dentro de Chile siguen usando las tarifas del panel (src/lib/shipping.ts).
 *
 * Docs: https://docs.envia.com
 */

export interface EnviaCountry {
  code: string;
  name: string;
}

export interface EnviaState {
  code: string;
  name: string;
}

export interface EnviaQuote {
  /** Identificador estable de la cotización: `envia:<carrier>:<service>`. */
  rateId: string;
  carrier: string;
  service: string;
  label: string;
  /** Precio en CLP, entero. */
  price: number;
  deliveryEstimate: string | null;
}

export interface EnviaDestination {
  country: string;
  state: string;
  city: string;
  postalCode: string;
  street: string;
  number: string;
  name: string;
  phone: string;
  email: string;
}

const LIVE = process.env.ENVIA_MODE === 'live';
const SHIP_API = LIVE ? 'https://api.envia.com' : 'https://api-test.envia.com';
const QUERIES_API = 'https://queries.envia.com';

export function enviaConfigured(): boolean {
  return Boolean(process.env.ENVIA_API_KEY);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.ENVIA_API_KEY ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { headers: headers(), next: { revalidate } });
  if (!res.ok) throw new Error(`Envía ${res.status} en ${url}`);
  return (await res.json()) as T;
}

/** Países a los que se puede despachar, sin Chile (ese va por las tarifas propias). */
export async function enviaCountries(): Promise<EnviaCountry[]> {
  if (!enviaConfigured()) return [];
  try {
    const json = await getJson<{ data?: Array<{ code?: string; name?: string }> }>(
      `${QUERIES_API}/country`,
      86_400,
    );
    return (json.data ?? [])
      .filter((c): c is EnviaCountry => Boolean(c.code && c.name) && c.code !== 'CL')
      .map((c) => ({ code: c.code, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } catch (error) {
    console.error('[envia:countries]', error);
    return [];
  }
}

/** Estados / provincias de un país. Vacío si el país no los usa. */
export async function enviaStates(country: string): Promise<EnviaState[]> {
  if (!enviaConfigured() || !/^[A-Z]{2}$/.test(country)) return [];
  try {
    const json = await getJson<{ data?: Array<{ code_2_digits?: string; code?: string; name?: string }> }>(
      `${QUERIES_API}/state?country_code=${country}`,
      86_400,
    );
    return (json.data ?? [])
      .map((s) => ({ code: s.code_2_digits ?? s.code ?? '', name: s.name ?? '' }))
      .filter((s) => s.code && s.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } catch (error) {
    console.error('[envia:states]', error);
    return [];
  }
}

/** Paqueterías habilitadas en la cuenta para envíos internacionales desde Chile. */
async function internationalCarriers(): Promise<string[]> {
  const configured = process.env.ENVIA_CARRIERS?.split(',').map((c) => c.trim()).filter(Boolean);
  if (configured?.length) return configured;
  try {
    const json = await getJson<{ data?: Array<{ name?: string }> }>(
      `${QUERIES_API}/available-carrier/CL/1`,
      3_600,
    );
    return [...new Set((json.data ?? []).map((c) => c.name).filter((n): n is string => Boolean(n)))];
  } catch (error) {
    console.error('[envia:carriers]', error);
    return [];
  }
}

function origin() {
  const env = process.env;
  return {
    name: env.ENVIA_ORIGIN_NAME ?? 'TAUPOC Chile',
    company: env.ENVIA_ORIGIN_COMPANY ?? 'TAUPOC',
    email: env.ENVIA_ORIGIN_EMAIL ?? env.ADMIN_ALERT_EMAIL ?? '',
    phone: env.ENVIA_ORIGIN_PHONE ?? '',
    street: env.ENVIA_ORIGIN_STREET ?? '',
    number: env.ENVIA_ORIGIN_NUMBER ?? '',
    district: env.ENVIA_ORIGIN_DISTRICT ?? '',
    city: env.ENVIA_ORIGIN_CITY ?? 'Santiago',
    state: env.ENVIA_ORIGIN_STATE ?? 'RM',
    country: 'CL',
    postalCode: env.ENVIA_ORIGIN_POSTAL_CODE ?? '',
  };
}

/** Convierte el precio que entrega Envía a CLP entero. Null si no hay cómo. */
function toCLP(amount: number, currency: string): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cur = currency.toUpperCase();
  if (cur === 'CLP') return Math.round(amount);
  const rate = Number(process.env[`ENVIA_${cur}_TO_CLP`]);
  return rate > 0 ? Math.round(amount * rate) : null;
}

/**
 * Cotiza el despacho internacional con todas las paqueterías disponibles.
 * Envía cotiza una paquetería por llamada, así que van en paralelo.
 */
export async function enviaQuotes(dest: EnviaDestination, weightGrams: number): Promise<EnviaQuote[]> {
  if (!enviaConfigured()) return [];
  const carriers = await internationalCarriers();
  if (carriers.length === 0) return [];

  const env = process.env;
  const weightKg = Math.max(0.1, Math.ceil((weightGrams || Number(env.ENVIA_DEFAULT_WEIGHT_G ?? 500)) / 100) / 10);
  const pkg = {
    content: 'Trajes de natación',
    amount: 1,
    type: 'box',
    weight: weightKg,
    weightUnit: 'KG',
    lengthUnit: 'CM',
    insurance: 0,
    declaredValue: 0,
    dimensions: {
      length: Number(env.ENVIA_BOX_LENGTH_CM ?? 30),
      width: Number(env.ENVIA_BOX_WIDTH_CM ?? 25),
      height: Number(env.ENVIA_BOX_HEIGHT_CM ?? 8),
    },
  };
  const destination = {
    name: dest.name,
    email: dest.email,
    phone: dest.phone,
    street: dest.street,
    number: dest.number,
    city: dest.city,
    state: dest.state,
    country: dest.country,
    postalCode: dest.postalCode,
  };

  const results = await Promise.all(
    carriers.map(async (carrier) => {
      try {
        const res = await fetch(`${SHIP_API}/ship/rate/`, {
          method: 'POST',
          headers: headers(),
          cache: 'no-store',
          body: JSON.stringify({
            origin: origin(),
            destination,
            packages: [pkg],
            shipment: { carrier, type: 1 },
            settings: { currency: 'CLP' },
          }),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          data?: Array<{
            carrier?: string;
            service?: string;
            serviceDescription?: string;
            deliveryEstimate?: string;
            totalPrice?: number | string;
            currency?: string;
          }>;
        };
        return (json.data ?? []).flatMap((q): EnviaQuote[] => {
          const price = toCLP(Number(q.totalPrice), q.currency ?? 'CLP');
          if (price == null || !q.service) return [];
          const name = q.carrier ?? carrier;
          return [
            {
              rateId: `envia:${name}:${q.service}`,
              carrier: name,
              service: q.service,
              label: q.serviceDescription || q.service,
              price,
              deliveryEstimate: q.deliveryEstimate ?? null,
            },
          ];
        });
      } catch (error) {
        console.error('[envia:rate]', carrier, error);
        return [];
      }
    }),
  );

  return results.flat().sort((a, b) => a.price - b.price);
}
