/**
 * Reglas del checkout de taupoc.lat que no dependen del servidor: los usa el
 * formulario para mostrar el total y la acción para cobrarlo, así los dos
 * calculan exactamente lo mismo.
 */
import { clpToIntlCents, type FxConfig } from './fx';

export interface IntlLineInput {
  unitPrice: number; // CLP con IVA, precio de taupoc.cl
  quantity: number;
}

/** Precio unitario en centavos de dólar y total de la línea. */
export function intlLine(line: IntlLineInput, fx: FxConfig) {
  const unitCents = clpToIntlCents(line.unitPrice, fx);
  return { unitCents, lineCents: unitCents * line.quantity };
}

/**
 * Envío: Envía cotiza en pesos y se cobra a costo en dólares, sin margen ni
 * IVA, redondeado hacia arriba al centavo.
 */
export function shippingCents(clp: number, fx: Pick<FxConfig, 'clpPerUsd'>): number {
  return Math.ceil((clp / fx.clpPerUsd) * 100);
}

/**
 * Documento de identidad tributaria que piden las aduanas y los couriers para
 * entregar una importación. Por defecto se pide en todos los destinos; acá
 * solo cambia cómo se llama en cada país.
 */
const TAX_ID_LABEL: Record<string, string> = {
  AR: 'CUIT, CUIL o DNI',
  BO: 'NIT o CI',
  BR: 'CPF o CNPJ',
  CO: 'Cédula o NIT',
  CR: 'Cédula',
  DO: 'Cédula o RNC',
  EC: 'Cédula o RUC',
  GT: 'NIT o DPI',
  MX: 'RFC o CURP',
  PA: 'Cédula o RUC',
  PE: 'DNI o RUC',
  PY: 'Cédula o RUC',
  UY: 'Cédula o RUT',
  US: 'SSN o EIN (opcional)',
  VE: 'Cédula o RIF',
};

/** Países donde el documento es opcional para el courier. */
const TAX_ID_OPTIONAL = new Set(['US', 'CA']);

export function taxIdRule(country: string): { label: string; required: boolean } {
  return {
    label: TAX_ID_LABEL[country] ?? 'Documento de identidad o número tributario',
    required: !TAX_ID_OPTIONAL.has(country),
  };
}
