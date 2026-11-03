import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './db';
import { logOrderEvent, ORDER_STATUS_LABEL } from './orders';
import { adjustStock, checkLowStock, reportOversold } from './inventory';
import { oversoldUnits, releaseOrderReservation } from './reservations';
import { formatCLP } from './money';
import { trackingUrlFor } from './shipping';
import { hasIntlStatusMail, sendIntlOrderStatus } from './mail-intl';
import {
  sendAdminNewOrder,
  sendOrderPlaced,
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
    paymentDiscount: order.paymentDiscount,
    paymentMethod: order.paymentMethod,
    couponCode: order.couponCode,
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
 * Se usan también al crear un pedido desde el panel.
 */
const AVISO_POR_ESTADO: Partial<Record<OrderStatus, (order: OrderMailData) => Promise<unknown>>> = {
  PENDING: sendOrderPlaced,
  PAID: sendOrderPaid,
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
  if (!Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABEL, status))
    return { ok: false, message: 'Estado inválido.' };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) return { ok: false, message: 'Pedido no encontrado.', notify: false };
    if (order.status === status)
      return { ok: true, message: 'El pedido ya estaba en ese estado.', notify: false };
    if (status === 'PENDING' && order.stockCommitted)
      return {
        ok: false,
        message: 'Cancela el pedido antes de volver a dejarlo pendiente.',
        notify: false,
      };
    const willCommit = COMPROMETE_STOCK.includes(status);
    const willRestore = status === 'CANCELLED' || status === 'REFUNDED';
    // Las unidades apartadas mientras el cliente pagaba se sueltan siempre
    // que el pedido se paga o se cancela: si se paga, el stock se descuenta
    // justo abajo; si se cancela, vuelven a estar disponibles.
    if ((willCommit && !order.stockCommitted) || willRestore) await releaseOrderReservation(tx, id);
    let oversold: Awaited<ReturnType<typeof oversoldUnits>> = [];
    if ((willCommit && !order.stockCommitted) || (willRestore && order.stockCommitted)) {
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const item of items)
        if (item.variantId)
          await adjustStock(tx, {
            variantId: item.variantId,
            delta: willCommit ? -item.quantity : item.quantity,
            type: willCommit ? 'SALE' : status === 'REFUNDED' ? 'RETURN' : 'CANCEL',
            reason: `Pedido ${order.number}: ${ORDER_STATUS_LABEL[status]}`,
            actorEmail: actor,
            orderId: id,
          });
      if (willCommit) oversold = await oversoldUnits(tx, id);
    }
    await tx.order.update({
      where: { id },
      data: {
        status,
        stockCommitted: willCommit ? true : willRestore ? false : order.stockCommitted,
        ...(willCommit && order.paymentStatus !== 'APPROVED'
          ? { paymentStatus: 'APPROVED', paidAt: new Date() }
          : {}),
        ...(status === 'PENDING' ? { paymentStatus: 'PENDING', paidAt: null } : {}),
        ...(status === 'CANCELLED' && order.creationKey ? { paymentStatus: 'CANCELLED' } : {}),
        ...(status === 'REFUNDED' && order.creationKey ? { paymentStatus: 'REFUNDED' } : {}),
        ...(status === 'SHIPPED' && !order.shippedAt ? { shippedAt: new Date() } : {}),
        ...(status === 'DELIVERED' && !order.deliveredAt ? { deliveredAt: new Date() } : {}),
      },
    });
    if (willCommit && order.paymentStatus !== 'APPROVED' && order.couponId) {
      await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
    }
    await tx.orderEvent.create({
      data: {
        orderId: id,
        type: 'status_change',
        message: `Estado cambiado a ${ORDER_STATUS_LABEL[status]}.`,
        actor,
      },
    });
    return {
      ok: true,
      message: `Pedido marcado como ${ORDER_STATUS_LABEL[status].toLowerCase()}.`,
      notify: status !== 'PAID' || order.paymentStatus !== 'APPROVED',
      oversold,
    };
  });
  if (result.oversold?.length) await reportOversold(id, result.oversold);
  if (result.ok && COMPROMETE_STOCK.includes(status)) void checkLowStock();
  if (params.notify !== false && result.notify) await notifyOrderStatus(id, status, actor);
  return { ok: result.ok, message: result.message };
}

/**
 * Confirma o rechaza la transferencia de un pedido.
 *
 * Confirmar es marcar el pedido como pagado: desde ahí sigue el mismo camino
 * que un pago de Mercado Pago (stock, cupón y correo de pago confirmado).
 * Rechazar lo cancela y avisa al cliente.
 */
export async function resolveTransfer(params: {
  orderId: string;
  decision: 'confirm' | 'reject';
  actor: string;
  /** Número de operación o comentario del abono, para el historial. */
  reference?: string;
}): Promise<{ ok: boolean; message: string }> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  if (order.paymentMethod !== 'TRANSFER') {
    return { ok: false, message: 'Este pedido no se paga por transferencia.' };
  }
  if (order.paymentStatus === 'APPROVED') {
    return { ok: false, message: 'La transferencia de este pedido ya estaba confirmada.' };
  }
  if (order.status !== 'PENDING') {
    return { ok: false, message: `El pedido está ${ORDER_STATUS_LABEL[order.status].toLowerCase()}: ya no espera la transferencia.` };
  }

  const reference = params.reference?.trim().slice(0, 200) || null;

  if (params.decision === 'reject') {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REJECTED' } });
    await logOrderEvent({
      orderId: order.id,
      type: 'transfer_rejected',
      message: `Transferencia rechazada${reference ? ` (${reference})` : ''}.`,
      actor: params.actor,
    });
    const result = await changeOrderStatus({ orderId: order.id, status: 'CANCELLED', actor: params.actor });
    return result.ok ? { ok: true, message: 'Transferencia rechazada y pedido cancelado.' } : result;
  }

  await logOrderEvent({
    orderId: order.id,
    type: 'transfer_confirmed',
    message: `Transferencia de ${formatCLP(order.total)} confirmada${reference ? ` (${reference})` : ''}.`,
    actor: params.actor,
    payload: reference ? { reference } : undefined,
  });
  const result = await changeOrderStatus({ orderId: order.id, status: 'PAID', actor: params.actor });
  if (!result.ok) return result;

  // El mismo aviso interno que manda el webhook cuando se acredita un pago.
  const payload = await orderMailPayload(order.id);
  if (payload) await sendAdminNewOrder(payload).catch(() => {});

  return { ok: true, message: 'Transferencia confirmada. El pedido quedó pagado y se avisó al cliente.' };
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
    },
  });

  await logOrderEvent({
    orderId: params.orderId,
    type: 'tracking',
    message: `Seguimiento ${carrier} ${tracking} cargado${shouldShip ? ' y pedido marcado como despachado' : ''}.`,
    actor: params.actor,
  });

  if (shouldShip) {
    if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
      await changeOrderStatus({ orderId: params.orderId, status: 'SHIPPED', actor: params.actor });
    } else if (order.trackingNumber !== tracking || order.shippingCarrier !== carrier) {
      await notifyOrderStatus(params.orderId, 'SHIPPED', params.actor);
    }
  }

  return {
    ok: true,
    message: shouldShip
      ? 'Seguimiento guardado. El resultado del aviso figura en el historial.'
      : 'Seguimiento guardado.',
  };
}

/** El historial distingue aceptación, omisión y fallo de entrega al proveedor. */
export async function notifyOrderStatus(orderId: string, status: OrderStatus, actor: string) {
  // Los pedidos de taupoc.lat tienen sus propios correos: en dólares y con su marca.
  const intl =
    (await prisma.order.findUnique({ where: { id: orderId }, select: { storefront: true } }))?.storefront === 'INTL';
  const send = AVISO_POR_ESTADO[status];
  if (intl ? !hasIntlStatusMail(status) : !send) return;
  let message: string;
  try {
    let result: { skipped?: boolean; error?: unknown } | undefined;
    if (intl) {
      result = await sendIntlOrderStatus(orderId, status);
    } else {
      const payload = await orderMailPayload(orderId);
      if (!payload || !send) return;
      result = (await send(payload)) as { skipped?: boolean; error?: unknown } | undefined;
    }
    message = result?.error
      ? 'El proveedor rechazó el correo de estado. Revisa la configuración del correo.'
      : !result || result.skipped
        ? 'Correo no enviado: revisa el transporte y las notificaciones en Ajustes.'
        : 'Correo de estado aceptado por el proveedor.';
  } catch {
    message = 'No se pudo enviar el correo de estado. Revisa el proveedor de correo.';
  }
  await logOrderEvent({ orderId, type: 'status_email', message, actor }).catch((error) =>
    console.error('[status-email:log]', error),
  );
}
