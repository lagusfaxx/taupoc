import 'server-only';
import { prisma } from './db';

/**
 * Números de pedido correlativos y legibles: TP-1001, TP-1002...
 * Se generan con un contador atómico para evitar colisiones bajo carga.
 */
export async function nextOrderNumber(): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { key: 'order' },
    create: { key: 'order', value: 1001 },
    update: { value: { increment: 1 } },
  });
  return `TP-${counter.value}`;
}

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

/** Color semántico para los badges de estado. */
export function orderStatusTone(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'muted' {
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

export function paymentStatusTone(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'muted' {
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

export async function logOrderEvent(params: {
  orderId: string;
  type: string;
  message: string;
  actor?: string | null;
  payload?: object;
}) {
  await prisma.orderEvent.create({
    data: {
      orderId: params.orderId,
      type: params.type,
      message: params.message,
      actor: params.actor ?? null,
      payload: (params.payload ?? undefined) as object | undefined,
    },
  });
}
