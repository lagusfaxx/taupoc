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

// Las etiquetas y tonos viven en order-labels.ts para poder importarse
// también desde componentes de cliente.
export {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  orderStatusTone,
  paymentStatusTone,
} from './order-labels';

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
