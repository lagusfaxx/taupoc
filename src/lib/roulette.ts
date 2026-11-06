import type { CouponType } from '@prisma/client';
import type { Storefront } from './storefront';

/**
 * Premios de la ruleta. Los segmentos se dibujan en este orden y el servidor
 * elige el premio por peso, nunca el navegador. Todo lo que se dibuja se
 * puede ganar: un segmento con peso cero sería publicidad engañosa. El envío gratis existe solo
 * en taupoc.cl: en taupoc.lat ese cupón no se puede aplicar.
 */
export interface RoulettePrize {
  id: string;
  label: string;
  type: CouponType;
  value: number;
  weight: number;
}

const CL: RoulettePrize[] = [
  { id: 'p5', label: '5% OFF', type: 'PERCENT', value: 5, weight: 34 },
  { id: 'envio', label: 'Envío gratis', type: 'FREE_SHIPPING', value: 0, weight: 22 },
  { id: 'p10', label: '10% OFF', type: 'PERCENT', value: 10, weight: 28 },
  { id: 'p15', label: '15% OFF', type: 'PERCENT', value: 15, weight: 8 },
  { id: 'p7', label: '7% OFF', type: 'PERCENT', value: 7, weight: 6 },
  { id: 'p20', label: '20% OFF', type: 'PERCENT', value: 20, weight: 2 },
];

const INTL: RoulettePrize[] = [
  { id: 'p5', label: '5% OFF', type: 'PERCENT', value: 5, weight: 38 },
  { id: 'p7', label: '7% OFF', type: 'PERCENT', value: 7, weight: 22 },
  { id: 'p10', label: '10% OFF', type: 'PERCENT', value: 10, weight: 26 },
  { id: 'p15', label: '15% OFF', type: 'PERCENT', value: 15, weight: 6 },
  { id: 'p12', label: '12% OFF', type: 'PERCENT', value: 12, weight: 6 },
  { id: 'p20', label: '20% OFF', type: 'PERCENT', value: 20, weight: 2 },
];

export function roulettePrizes(store: Storefront): RoulettePrize[] {
  return store === 'INTL' ? INTL : CL;
}

/** Lo que el navegador necesita para dibujar la rueda: sin pesos. */
export function rouletteSegments(store: Storefront): { id: string; label: string }[] {
  return roulettePrizes(store).map(({ id, label }) => ({ id, label }));
}

export function pickPrize(store: Storefront, random = Math.random()): RoulettePrize {
  const prizes = roulettePrizes(store);
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = random * total;
  for (const prize of prizes) {
    if (prize.weight <= 0) continue;
    if (r < prize.weight) return prize;
    r -= prize.weight;
  }
  return prizes.find((p) => p.weight > 0)!;
}
