import 'server-only';
import type { RateMode, ShippingRate, ShippingZone } from '@prisma/client';
import { prisma } from './db';
import { getSettings } from './settings';

export interface ShippingContext {
  /** Código de región de destino (ver src/lib/chile.ts). */
  region: string | null;
  /** Suma de los ítems antes de descuentos de envío. */
  subtotal: number;
  /** Peso total del pedido en gramos. */
  weightGrams: number;
}

export interface ShippingOption {
  rateId: string;
  carrier: string;
  label: string;
  description: string | null;
  price: number;
  /** El precio quedó en cero por superar el umbral de envío gratis. */
  freeApplied: boolean;
  isPickup: boolean;
  pickupInfo: string | null;
  etaMinDays: number;
  etaMaxDays: number;
  zoneName: string;
}

type RateWithZone = ShippingRate & { zone: ShippingZone };

function matchesRange(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

/** ¿Esta tarifa aplica al contexto del pedido? */
function rateApplies(rate: RateWithZone, ctx: ShippingContext): boolean {
  if (!rate.active || !rate.zone.active) return false;

  // El retiro en tienda / entrega en torneo no depende de la región.
  if (!rate.isPickup) {
    if (!ctx.region) return false;
    if (!rate.zone.regions.includes(ctx.region)) return false;
  }

  const mode: RateMode = rate.mode;
  if (mode === 'BY_WEIGHT') {
    return matchesRange(ctx.weightGrams, rate.minWeightG, rate.maxWeightG);
  }
  if (mode === 'BY_SUBTOTAL') {
    return matchesRange(ctx.subtotal, rate.minSubtotal, rate.maxSubtotal);
  }
  // FLAT: aplica siempre que la zona coincida, respetando el mínimo si existe.
  return matchesRange(ctx.subtotal, rate.minSubtotal, rate.maxSubtotal);
}

function priceFor(rate: RateWithZone, ctx: ShippingContext, globalFreeOver: number | null) {
  if (rate.isPickup) return { price: rate.price, freeApplied: false };

  const threshold = rate.freeOverSubtotal ?? globalFreeOver;
  if (threshold != null && threshold > 0 && ctx.subtotal >= threshold) {
    return { price: 0, freeApplied: true };
  }
  return { price: rate.price, freeApplied: false };
}

/**
 * Devuelve las opciones de envío disponibles, ordenadas por precio.
 * Todas las reglas vienen de la base de datos: el admin las edita sin tocar código.
 */
export async function getShippingOptions(ctx: ShippingContext): Promise<ShippingOption[]> {
  const settings = await getSettings();
  const rates = await prisma.shippingRate.findMany({
    where: { active: true },
    include: { zone: true },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
  });

  const options: ShippingOption[] = [];
  const seen = new Set<string>();

  for (const rate of rates) {
    if (!rateApplies(rate, ctx)) continue;
    // Evita duplicar la misma etiqueta de retiro entre zonas.
    const dedupeKey = rate.isPickup ? `pickup:${rate.label}` : rate.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { price, freeApplied } = priceFor(rate, ctx, settings.freeShippingOver);
    options.push({
      rateId: rate.id,
      carrier: rate.carrier,
      label: rate.label,
      description: rate.description,
      price,
      freeApplied,
      isPickup: rate.isPickup,
      pickupInfo: rate.pickupInfo,
      etaMinDays: rate.etaMinDays,
      etaMaxDays: rate.etaMaxDays,
      zoneName: rate.zone.name,
    });
  }

  return options.sort((a, b) => {
    if (a.isPickup !== b.isPickup) return a.isPickup ? -1 : 1;
    return a.price - b.price;
  });
}

/** Recalcula una opción específica en el servidor, para no confiar en el cliente. */
export async function resolveShippingOption(
  rateId: string,
  ctx: ShippingContext,
): Promise<ShippingOption | null> {
  const options = await getShippingOptions(ctx);
  return options.find((o) => o.rateId === rateId) ?? null;
}

/** Cuánto falta para alcanzar el envío gratis (null si ya se alcanzó o no aplica). */
export async function freeShippingGap(subtotal: number): Promise<number | null> {
  const { freeShippingOver } = await getSettings();
  if (!freeShippingOver || freeShippingOver <= 0) return null;
  const gap = freeShippingOver - subtotal;
  return gap > 0 ? gap : null;
}

export function trackingUrlFor(carrier: string, tracking: string): string | null {
  const t = encodeURIComponent(tracking.trim());
  if (!t) return null;
  const c = carrier.toLowerCase();
  if (c.includes('chilexpress')) return `https://www.chilexpress.cl/Views/ChilexpressCL/Resultado-busqueda.aspx?DATA=${t}`;
  if (c.includes('starken')) return `https://www.starken.cl/seguimiento?codigo=${t}`;
  if (c.includes('correos')) return `https://seguimientoenlinea.correos.cl/?n=${t}`;
  if (c.includes('bluexpress') || c.includes('blue')) return `https://www.bluex.cl/seguimiento/?n=${t}`;
  return null;
}
