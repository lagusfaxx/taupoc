import type { SiteSettings } from './settings';
import type { Storefront } from './storefront';

/**
 * Venta a pedido.
 *
 * Una talla agotada de un producto publicado se puede comprar igual: el
 * cliente paga, la talla se pide a fábrica y se despacha cuando llega. Esas
 * unidades quedan anotadas en `OrderItem.backorderQty` y no se apartan ni se
 * descuentan del inventario, porque nunca estuvieron en él.
 *
 * Hay dos formas de cerrarla (Ajustes): por WhatsApp, que es la de fábrica —el
 * cliente escribe, el equipo confirma que la fábrica tiene la talla y recién
 * entonces cobra—, o pagando en la tienda sin confirmar. Lo de arriba describe
 * la segunda; en la primera el carrito sigue rechazando la talla agotada.
 *
 * Solo aplica en taupoc.cl: en taupoc.lat el plazo de envío es otro y no se
 * ofrece.
 */

/** Tope de unidades a pedido por talla en un mismo carrito. */
export const BACKORDER_MAX_PER_LINE = 3;

export interface BackorderPolicy {
  enabled: boolean;
  days: number;
}

export function backorderPolicy(
  settings: Pick<SiteSettings, 'backorderEnabled' | 'backorderDays' | 'backorderMode'>,
  store: Storefront = 'CL',
): BackorderPolicy {
  // Por WhatsApp la venta no pasa por el carrito: la cierra el equipo después
  // de confirmar con fábrica.
  return {
    enabled: settings.backorderEnabled && settings.backorderMode === 'online' && store === 'CL',
    days: settings.backorderDays,
  };
}

/** Cuántas unidades de una línea hay que pedir a fábrica. */
export function backorderUnits(quantity: number, available: number, policy: BackorderPolicy): number {
  if (!policy.enabled) return 0;
  return Math.max(0, quantity - Math.max(0, available));
}

/** "hasta 7 días" */
export function backorderLead(days: number): string {
  return `hasta ${days} ${days === 1 ? 'día' : 'días'}`;
}
