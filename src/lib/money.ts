/**
 * El peso chileno no usa decimales: todos los montos viajan como enteros.
 */

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 139900 → "$139.900" */
export function formatCLP(amount: number): string {
  return clpFormatter.format(Math.round(amount || 0));
}

/** 139900 → "139.900" (sin símbolo, para inputs y tablas) */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('es-CL').format(Math.round(amount || 0));
}

/** "$139.900" | "139900" | "139.900" → 139900 */
export function parseCLP(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.round(input);
  if (!input) return 0;
  const digits = String(input).replace(/[^\d-]/g, '');
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

export function percentOff(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Cuotas sin interés estimadas, para mostrar en la ficha de producto. */
export function installment(total: number, n: number): number {
  return Math.round(total / n);
}
