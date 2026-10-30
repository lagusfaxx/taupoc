/**
 * Precios en dólares de taupoc.lat.
 *
 * Se calculan siempre desde el precio chileno (CLP con IVA), que sigue siendo
 * el único precio que se carga en el panel. La venta al extranjero es
 * exportación y va exenta de IVA, así que se parte del neto:
 *
 *   neto = CLP / (1 + IVA)
 *   USD  = neto / tipo de cambio × (1 + margen)
 *
 * y se redondea hacia arriba a un valor comercial. El redondeo es por unidad:
 * el total del carrito es la suma de precios que el cliente ya vio.
 *
 * Sin dependencias del servidor: lo usa también el navegador para mostrar
 * montos y los tests para fijar las reglas.
 */

export type PriceRoundingRule = 'CENTS_99' | 'WHOLE' | 'WHOLE_9' | 'WHOLE_5';

export interface FxConfig {
  clpPerUsd: number;
  marginPct: number;
  vatPct: number;
  rounding: PriceRoundingRule;
}

/** El entero más chico, mayor o igual a `value`, que termina en `digit`. */
function ceilEndingIn(value: number, digit: number): number {
  const base = Math.ceil(value);
  return base + ((digit - (base % 10) + 10) % 10);
}

/** Dólares exactos → centavos con el redondeo comercial elegido. */
export function roundUsd(usd: number, rule: PriceRoundingRule): number {
  // Los centavos se calculan sobre un valor ya acotado a 6 decimales para que
  // un 139.0000000001 de punto flotante no salte al siguiente escalón.
  const exact = Math.round(usd * 1e6) / 1e6;
  switch (rule) {
    case 'WHOLE':
      return Math.ceil(exact) * 100;
    case 'WHOLE_9':
      return ceilEndingIn(exact, 9) * 100;
    case 'WHOLE_5':
      return ceilEndingIn(exact, 5) * 100;
    case 'CENTS_99': {
      const whole = Math.ceil(exact);
      // 138,40 → 138,99; 138,995 → 139,99.
      return (exact <= whole - 0.01 ? whole : whole + 1) * 100 - 1;
    }
  }
}

/** Precio chileno con IVA → centavos de dólar para taupoc.lat. */
export function clpToIntlCents(clpWithVat: number, fx: FxConfig): number {
  if (!(fx.clpPerUsd > 0)) throw new Error('El tipo de cambio debe ser mayor que cero.');
  const net = clpWithVat / (1 + fx.vatPct / 100);
  const usd = (net / fx.clpPerUsd) * (1 + fx.marginPct / 100);
  return roundUsd(usd, fx.rounding);
}

/** 14900 → "US$ 149"; 13899 → "US$ 138.99". */
export function formatUsdCents(cents: number): string {
  const value = cents / 100;
  const text = Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `US$ ${text}`;
}

export const ROUNDING_LABEL: Record<PriceRoundingRule, string> = {
  WHOLE_9: 'Entero terminado en 9 (149)',
  WHOLE_5: 'Entero terminado en 5 (145)',
  WHOLE: 'Entero (141)',
  CENTS_99: 'Terminado en ,99 (140,99)',
};
