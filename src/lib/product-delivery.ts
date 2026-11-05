import 'server-only';
import { prisma } from './db';
import { enviaCountries, enviaQuotes, enviaStates, enviaZip } from './envia';
import { deliveryDays, type DeliveryEstimate, type DeliveryLocation } from './delivery-location';

const cache = new Map<string, { until: number; value: DeliveryEstimate | null }>();
const pending = new Map<string, Promise<DeliveryEstimate | null>>();
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

async function estimate(
  location: DeliveryLocation,
  weight: number,
): Promise<DeliveryEstimate | null> {
  const key = JSON.stringify([
    location.country,
    location.city,
    location.postalCode,
    location.state,
    location.stateName,
    weight,
  ]);
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;
  const running = pending.get(key);
  if (running) return running;
  if (pending.size >= 64) return null;
  const task = (async () => {
    const [zip, states] = await Promise.all([
      enviaZip(location.country, location.postalCode),
      enviaStates(location.country),
    ]);
    const code = location.state.split('-').at(-1) ?? '';
    const state =
      zip?.state ||
      states.find(
        (s) =>
          normalize(s.name) === normalize(location.stateName) ||
          s.code === code ||
          s.code.padStart(2, '0') === code.padStart(2, '0'),
      )?.code ||
      code;
    const result = await enviaQuotes(
      {
        country: location.country,
        state,
        city: location.city,
        postalCode: location.postalCode,
        street: '',
        number: '',
        name: '',
        email: '',
        phone: '',
      },
      weight,
      { timeoutMs: 8000 },
    );
    // Envía ordena las tarifas por precio. Solo se muestra un plazo publicado por una paquetería.
    const quote = result.quotes.find((q) => deliveryDays(q.deliveryEstimate));
    const value = quote
      ? {
          days: deliveryDays(quote.deliveryEstimate)!,
          carrier:
            ({ dhl: 'DHL', fedex: 'FedEx', ups: 'UPS', usps: 'USPS' } as Record<string, string>)[
              quote.carrier.toLowerCase()
            ] ?? quote.carrier,
          service: quote.label.replace(/[®™]/g, '').trim(),
        }
      : null;
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + (value ? 10 * 60_000 : 15_000), value });
    return value;
  })()
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

/** El peso y la disponibilidad siempre se consultan en catálogo; el navegador no fija la cotización. */
export async function productDeliveryEstimates(
  ids: string[],
  location: DeliveryLocation,
): Promise<Record<string, DeliveryEstimate | null>> {
  if (location.country === 'CL' || !location.postalCode) return {};
  const countries = await enviaCountries();
  if (!countries.some((c) => c.code === location.country)) return {};
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    select: {
      id: true,
      weightGrams: true,
      variants: {
        where: { active: true, color: { active: true } },
        select: { stock: true, reserved: true },
      },
    },
  });
  const available = products.filter((p) => p.variants.some((v) => v.stock > v.reserved));
  // Agrupa productos que usan el mismo peso facturable; las tarjetas por color no duplican consultas.
  const groups = new Map<number, string[]>();
  for (const p of available) {
    const grams = p.weightGrams || Number(process.env.ENVIA_DEFAULT_WEIGHT_G ?? 500);
    const weight = Math.max(100, Math.ceil(grams / 100) * 100);
    groups.set(weight, [...(groups.get(weight) ?? []), p.id]);
  }
  const pairs = await Promise.all(
    [...groups].map(async ([weight, productIds]) => {
      const result = await estimate(location, weight);
      return productIds.map((id) => [id, result] as const);
    }),
  );
  return Object.fromEntries(pairs.flat());
}
