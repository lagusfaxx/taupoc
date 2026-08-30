/**
 * Etiquetas y colores de estado de pedido.
 * Vive fuera de lib/orders.ts para poder usarse también en componentes de cliente.
 */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente de pago',
  PAID: 'Pagado',
  PROCESSING: 'En preparación',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROCESS: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  CHARGED_BACK: 'Contracargo',
  CANCELLED: 'Cancelado',
};

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

/** Color semántico para los badges de estado del pedido. */
export function orderStatusTone(status: string): Tone {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
      return 'ok';
    case 'PROCESSING':
    case 'SHIPPED':
      return 'info';
    case 'PENDING':
      return 'warn';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'bad';
    default:
      return 'muted';
  }
}

export function paymentStatusTone(status: string): Tone {
  switch (status) {
    case 'APPROVED':
      return 'ok';
    case 'IN_PROCESS':
      return 'info';
    case 'PENDING':
      return 'warn';
    case 'REJECTED':
    case 'CHARGED_BACK':
    case 'REFUNDED':
    case 'CANCELLED':
      return 'bad';
    default:
      return 'muted';
  }
}
