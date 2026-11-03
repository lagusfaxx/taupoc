import 'server-only';
import { prisma } from './db';
import type { FxConfig } from './fx';

export interface FxRate extends FxConfig {
  id: string;
  effectiveFrom: Date;
}

let cache: { data: FxRate | null; at: number } | null = null;
const TTL_MS = 15_000;

/**
 * El tipo de cambio vigente: la última fila cuya fecha ya se cumplió. `null`
 * si no hay ninguno; taupoc.lat entonces no muestra precios.
 */
export async function getCurrentFx(): Promise<FxRate | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const row = await prisma.exchangeRate.findFirst({
    where: { effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: 'desc' },
  });
  const data = row
    ? {
        id: row.id,
        clpPerUsd: Number(row.clpPerUsd),
        marginPct: Number(row.marginPct),
        vatPct: Number(row.vatPct),
        rounding: row.rounding,
        effectiveFrom: row.effectiveFrom,
      }
    : null;
  cache = { data, at: Date.now() };
  return data;
}

export function invalidateFx() {
  cache = null;
}
