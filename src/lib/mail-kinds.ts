/**
 * Catálogo de plantillas que se pueden probar desde el panel.
 *
 * Vive fuera de `mail.ts` porque ese módulo es `server-only` y este listado
 * lo necesita también el desplegable del navegador.
 */
export const PLANTILLAS_DE_PRUEBA = [
  { id: 'placed', label: 'Pedido recibido' },
  { id: 'placed-transfer', label: 'Pedido recibido · transferencia' },
  { id: 'paid', label: 'Pago confirmado' },
  { id: 'processing', label: 'En preparación' },
  { id: 'shipped', label: 'Despachado' },
  { id: 'delivered', label: 'Entregado' },
  { id: 'cancelled', label: 'Cancelado' },
  { id: 'refunded', label: 'Reembolsado' },
  { id: 'admin', label: 'Aviso al admin · pedido pagado' },
  { id: 'admin-transfer', label: 'Aviso al admin · transferencia por confirmar' },
  { id: 'lowstock', label: 'Aviso al admin · stock bajo' },
  { id: 'quote', label: 'Aviso al admin · cotización de club' },
  { id: 'reset', label: 'Restablecer contraseña' },
] as const;

export type PlantillaDePrueba = (typeof PLANTILLAS_DE_PRUEBA)[number]['id'];
