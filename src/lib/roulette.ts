import type { Storefront } from './storefront';

/**
 * Ruleta de descuento a cambio del correo. Toda la configuración vive en el
 * panel (Marketing → Ruleta) y se guarda en la tabla Setting; este módulo no
 * toca la base para poder usarse también en el navegador.
 *
 * El servidor elige el premio por peso, nunca el navegador. Cada segmento
 * que se dibuja tiene que poder ganarse: un premio con peso cero no se
 * muestra en la rueda.
 */

export const ROULETTE_KEY = 'roulette';

export type RoulettePrizeType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';

export interface RoulettePrize {
  id: string;
  /** Texto del segmento. Ej. "10% OFF". */
  label: string;
  type: RoulettePrizeType;
  /** Porcentaje (PERCENT) o monto en CLP (FIXED). Sin uso en FREE_SHIPPING. */
  value: number;
  /** Probabilidad relativa. 0 saca el premio de la rueda. */
  weight: number;
}

export interface RouletteConfig {
  enabled: boolean;
  /** Dónde se muestra. */
  showCL: boolean;
  showINTL: boolean;
  title: string;
  buttonLabel: string;
  /** Días de vigencia del cupón. */
  couponDays: number;
  /** Compra mínima para usar el cupón, en CLP. 0 = sin mínimo. */
  minSubtotal: number;
  /** Segundos de navegación antes de abrirse sola. 0 = solo con el botón. */
  autoOpenSeconds: number;
  /** Abrirla al mover el mouse hacia fuera de la página (escritorio). */
  exitIntent: boolean;
  /** Días sin volver a abrirse sola después de que la cierran sin girar. */
  snoozeDays: number;
  prizesCL: RoulettePrize[];
  prizesINTL: RoulettePrize[];
}

export const DEFAULT_ROULETTE: RouletteConfig = {
  enabled: false,
  showCL: true,
  showINTL: true,
  title: 'Gira y gana un descuento',
  buttonLabel: 'Gira y gana',
  couponDays: 7,
  minSubtotal: 0,
  autoOpenSeconds: 20,
  exitIntent: true,
  snoozeDays: 3,
  prizesCL: [
    { id: 'p5', label: '5% OFF', type: 'PERCENT', value: 5, weight: 34 },
    { id: 'envio', label: 'Envío gratis', type: 'FREE_SHIPPING', value: 0, weight: 22 },
    { id: 'p10', label: '10% OFF', type: 'PERCENT', value: 10, weight: 28 },
    { id: 'p15', label: '15% OFF', type: 'PERCENT', value: 15, weight: 8 },
    { id: 'p7', label: '7% OFF', type: 'PERCENT', value: 7, weight: 6 },
    { id: 'p20', label: '20% OFF', type: 'PERCENT', value: 20, weight: 2 },
  ],
  prizesINTL: [
    { id: 'p5', label: '5% OFF', type: 'PERCENT', value: 5, weight: 38 },
    { id: 'p7', label: '7% OFF', type: 'PERCENT', value: 7, weight: 22 },
    { id: 'p10', label: '10% OFF', type: 'PERCENT', value: 10, weight: 26 },
    { id: 'p15', label: '15% OFF', type: 'PERCENT', value: 15, weight: 6 },
    { id: 'p12', label: '12% OFF', type: 'PERCENT', value: 12, weight: 6 },
    { id: 'p20', label: '20% OFF', type: 'PERCENT', value: 20, weight: 2 },
  ],
};

/** Premios que van en la rueda de esa tienda: los que se pueden ganar. */
export function activePrizes(config: RouletteConfig, store: Storefront): RoulettePrize[] {
  const list = store === 'INTL' ? config.prizesINTL : config.prizesCL;
  // En taupoc.lat el cupón de envío gratis no se puede aplicar.
  return list.filter((p) => p.weight > 0 && !(store === 'INTL' && p.type === 'FREE_SHIPPING'));
}

export function rouletteVisible(config: RouletteConfig, store: Storefront): boolean {
  return (
    config.enabled &&
    (store === 'INTL' ? config.showINTL : config.showCL) &&
    activePrizes(config, store).length >= 2
  );
}

/** Lo que el navegador necesita para dibujar la rueda: sin pesos. */
export function rouletteSegments(config: RouletteConfig, store: Storefront): { id: string; label: string }[] {
  return activePrizes(config, store).map(({ id, label }) => ({ id, label }));
}

export function pickPrize(prizes: RoulettePrize[], random = Math.random()): RoulettePrize | null {
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  if (total <= 0) return null;
  let r = random * total;
  for (const prize of prizes) {
    if (prize.weight <= 0) continue;
    if (r < prize.weight) return prize;
    r -= prize.weight;
  }
  return prizes.find((p) => p.weight > 0) ?? null;
}
