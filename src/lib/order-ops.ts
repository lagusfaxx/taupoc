import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './db';
import { logOrderEvent, ORDER_STATUS_LABEL } from './orders';
import { commitStockForOrder, restoreStockForOrder } from './inventory';
import { trackingUrlFor } from './shipping';
import {
  sendOrderShipped,
  sendOrderPaid,
  sendOrderProcessing,
  sendOrderDelivered,
  sendOrderCancelled,
  sendOrderRefunded,
  type OrderMailData,
} from './mail';

/*
 * Operaciones de pedido compartidas por el panel y el servidor MCP. Viven acá
 * y no en las server actions para que las dos puertas apliquen exactamente
 * las mismas reglas de inventario y de aviso al cliente.
 */

export async function orderMailPayload(orderId: string): Promise<OrderMailData | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;
  return {
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    shippingLabel: order.shippingLabel,
    isPickup: order.isPickup,
    street: order.street,
    streetNumber: order.streetNumber,
    commune: order.commune,
    region: order.region,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrier: order.shippingCarrier,
    items: order.items,
  };
}

/**
 * Qué correo acompaña a cada estado.
 *
 * Los que no aparecen no avisan: PENDING ya lo cubre el correo de pedido
 * recibido que sale del propio checkout.
 */
const AVISO_POR_ESTADO: Partial<Record<OrderStatus, (order: OrderMailData) => Promise<unknown>>> = {
  PROCESSING: sendOrderProcessing,
  SHIPPED: sendOrderShipped,
  DELIVERED: sendOrderDelivered,
  CANCELLED: sendOrderCancelled,
  REFUNDED: sendOrderRefunded,
};

const COMPROMETE_STOCK: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/**
 * Cambia el estado del pedido y sincroniza el inventario.
 * Marcar como pagado descuenta stock; cancelar lo devuelve.
 */
export async function changeOrderStatus(params: {
  orderId: string;
  status: OrderStatus;
  actor: string;
  /** Avisa al cliente por correo. Por defecto sí, igual que el panel. */
  notify?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const { orderId: id, status, actor } = params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  if (order.status === status) return { ok: true, message: 'El pedido ya estaba en ese estado.' };

  const wasCommitted = COMPROMETE_STOCK.includes(order.status);
  const willCommit = COMPROMETE_STOCK.includes(status);

  await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === 'PAID' && order.paymentStatus !== 'APPROVED'
        ? { paymentStatus: 'APPROVED', paidAt: new Date() }
        : {}),
      ...(status === 'SHIPPED' && !order.shippedAt ? { shippedAt: new Date() } : {}),
      ...(status === 'DELIVERED' && !order.deliveredAt ? { deliveredAt: new Date() } : {}),
    },
  });

  if (!wasCommitted && willCommit) await commitStockForOrder(id);
  if (wasCommitted && (status === 'CANCELLED' || status === 'REFUNDED')) {
    await restoreStockForOrder(id, status === 'REFUNDED' ? 'RETURN' : 'CANCEL');
  }

  await logOrderEvent({
    orderId: id,
    type: 'status_change',
    message: `Estado cambiado a ${ORDER_STATUS_LABEL[status]}.`,
    actor,
  });

  if (params.notify !== false) {
    const payload = await orderMailPayload(id);
    if (payload) {
      // PAID va aparte: solo se avisa si el pago no venía ya aprobado, porque
      // en ese caso el webhook de Mercado Pago ya mandó su propio correo.
      const aviso =
        status === 'PAID'
          ? order.paymentStatus !== 'APPROVED'
            ? sendOrderPaid
            : null
          : (AVISO_POR_ESTADO[status] ?? null);
      if (aviso) await aviso(payload).catch(() => {});
    }
  }

  return { ok: true, message: `Pedido marcado como ${ORDER_STATUS_LABEL[status].toLowerCase()}.` };
}

/** Carga el seguimiento y, si se pide, marca el pedido como despachado. */
export async function saveOrderTracking(params: {
  orderId: string;
  trackingNumber: string;
  carrier?: string;
  markShipped: boolean;
  actor: string;
}): Promise<{ ok: boolean; message: string }> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };

  const carrier = params.carrier?.trim() || order.shippingCarrier || 'Chilexpress';
  const tracking = params.trackingNumber.trim();
  const shouldShip = params.markShipped;

  await prisma.order.update({
    where: { id: params.orderId },
    data: {
      shippingCarrier: carrier,
      trackingNumber: tracking,
      trackingUrl: trackingUrlFor(carrier, tracking),
      ...(shouldShip ? { status: 'SHIPPED', shippedAt: order.shippedAt ?? new Date() } : {}),
    },
  });

  await logOrderEvent({
    orderId: params.orderId,
    type: 'tracking',
    message: `Seguimiento ${carrier} ${tracking} cargado${shouldShip ? ' y pedido marcado como despachado' : ''}.`,
    actor: params.actor,
  });

  if (shouldShip) {
    const payload = await orderMailPayload(params.orderId);
    if (payload) await sendOrderShipped(payload).catch(() => {});
  }

  return {
    ok: true,
    message: shouldShip
      ? 'Seguimiento guardado y correo de despacho enviado al cliente.'
      : 'Seguimiento guardado.',
  };
}
