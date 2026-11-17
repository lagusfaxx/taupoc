/**
 * Tallas a pedido.
 *
 * Una talla agotada (pero publicada) no se muestra tachada: se ofrece "a
 * pedido" con un botón que abre WhatsApp con el producto, el color, la talla y
 * el SKU ya escritos. El equipo revisa a mano si la fábrica la tiene y recién
 * entonces cobra; el carrito sigue rechazando la talla agotada.
 *
 * Se activa y se le pone plazo en Ajustes. Solo en taupoc.cl.
 */

/** "hasta 7 días" */
export function backorderLead(days: number): string {
  return `hasta ${days} ${days === 1 ? 'día' : 'días'}`;
}
