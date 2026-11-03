import 'server-only';
import crypto from 'crypto';
import type { ReturnKind, ReturnStatus } from '@prisma/client';
import { prisma } from './db';
import { logOrderEvent } from './orders';
import { RETURN_KIND_LABEL, RETURN_STATUS_LABEL } from './order-labels';
import { formatCLP } from './money';
import { createReturnFeePreference, mpConfigured, siteUrl, type MpPaymentInfo } from './mercadopago';
import { sendAdminReturnFeePaid, sendReturnFeeRequest } from './mail';

/*
 * Devoluciones y cambios de talla.
 *
 * Una por pedido. El registro lleva el estado de la prenda que vuelve y, si el
 * panel lo crea, el cobro del envío que paga el cliente con Mercado Pago desde
 * un enlace público (/devoluciones/pago/<token>), que sirve también a quien
 * compró como invitado.
 *
 * El inventario no se toca acá: en un cambio de talla lo mueve "Cambiar
 * productos" y en una devolución con reembolso lo devuelve el reembolso.
 */

type Result = { ok: boolean; message: string };

const DEFAULT_FEE_LABEL = 'Costo de envío de la devolución';

export function returnPayUrl(token: string): string {
  return `${siteUrl()}/devoluciones/pago/${token}`;
}

/** Registra o actualiza la devolución del pedido. */
export async function saveOrderReturn(params: {
  orderId: string;
  kind: ReturnKind;
  status: ReturnStatus;
  reason?: string | null;
  actor: string;
}): Promise<Result> {
  if (!(params.kind in RETURN_KIND_LABEL)) return { ok: false, message: 'Tipo de devolución inválido.' };
  if (!(params.status in RETURN_STATUS_LABEL)) return { ok: false, message: 'Estado de devolución inválido.' };

  const order = await prisma.order.findUnique({ where: { id: params.orderId }, include: { orderReturn: true } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };

  const reason = params.reason?.trim().slice(0, 500) || null;
  const previous = order.orderReturn;

  await prisma.orderReturn.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, kind: params.kind, status: params.status, reason },
    update: { kind: params.kind, status: params.status, reason },
  });

  const message = !previous
    ? `Devolución registrada: ${RETURN_KIND_LABEL[params.kind].toLowerCase()} (${RETURN_STATUS_LABEL[params.status].toLowerCase()}).`
    : previous.status !== params.status
      ? `Devolución: ${RETURN_STATUS_LABEL[params.status].toLowerCase()}.`
      : 'Datos de la devolución actualizados.';
  await logOrderEvent({ orderId: order.id, type: 'return', message, actor: params.actor });

  return { ok: true, message: previous ? 'Devolución actualizada.' : 'Devolución registrada.' };
}

/** Quita la devolución del pedido (se registró por error). */
export async function deleteOrderReturn(params: { orderId: string; actor: string }): Promise<Result> {
  const current = await prisma.orderReturn.findUnique({ where: { orderId: params.orderId } });
  if (!current) return { ok: false, message: 'El pedido no tiene devolución.' };
  if (current.feeStatus === 'PAID') {
    return { ok: false, message: 'El cliente ya pagó el envío: anúlala en vez de borrarla.' };
  }
  await prisma.orderReturn.delete({ where: { id: current.id } });
  await logOrderEvent({ orderId: params.orderId, type: 'return', message: 'Devolución eliminada.', actor: params.actor });
  return { ok: true, message: 'Devolución eliminada.' };
}

/**
 * Crea o cambia el cobro del envío de la devolución y, si se pide, le manda
 * al cliente el enlace de pago.
 */
export async function setReturnFee(params: {
  orderId: string;
  amount: number;
  label?: string | null;
  notify: boolean;
  actor: string;
}): Promise<Result> {
  const amount = Math.round(params.amount);
  if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000) {
    return { ok: false, message: 'El monto debe estar entre $100 y $1.000.000.' };
  }
  if (!mpConfigured()) return { ok: false, message: 'Mercado Pago no está configurado (MP_ACCESS_TOKEN).' };

  const order = await prisma.order.findUnique({ where: { id: params.orderId }, include: { orderReturn: true } });
  if (!order) return { ok: false, message: 'Pedido no encontrado.' };
  const current = order.orderReturn;
  if (!current) return { ok: false, message: 'Primero registra la devolución.' };
  if (current.feeStatus === 'PAID') return { ok: false, message: 'El cliente ya pagó este envío.' };
  if (current.status === 'CANCELLED') return { ok: false, message: 'La devolución está anulada.' };

  const label = params.label?.trim().slice(0, 120) || DEFAULT_FEE_LABEL;
  const token = current.feeToken ?? crypto.randomBytes(18).toString('base64url');

  await prisma.orderReturn.update({
    where: { id: current.id },
    data: {
      feeAmount: amount,
      feeLabel: label,
      feeStatus: 'PENDING',
      feeToken: token,
      // Si cambió el monto, la preferencia anterior ya no sirve.
      feePreferenceId: null,
    },
  });

  await logOrderEvent({
    orderId: order.id,
    type: 'return_fee',
    message: `Cobro de envío de devolución creado: ${formatCLP(amount)}.`,
    actor: params.actor,
  });

  if (!params.notify) return { ok: true, message: 'Cobro creado. El cliente lo ve en el estado de su pedido.' };

  const result = await sendReturnFeeRequest({
    number: order.number,
    email: order.email,
    firstName: order.firstName,
    amount,
    label,
    reason: current.reason,
    payUrl: returnPayUrl(token),
  }).catch(() => ({ skipped: true as const }));
  const sent = result && !result.skipped;
  await logOrderEvent({
    orderId: order.id,
    type: 'email_sent',
    message: sent
      ? 'Correo con el enlace de pago del envío aceptado por el proveedor.'
      : 'Correo con el enlace de pago no enviado: revisa el proveedor de correo.',
    actor: params.actor,
  });
  return {
    ok: true,
    message: sent ? 'Cobro creado y enlace enviado al cliente.' : 'Cobro creado, pero el correo no salió. Copia el enlace y envíalo tú.',
  };
}

/** Quita el cobro (vuelve a "sin cobro") o lo deja sin cargo. */
export async function clearReturnFee(params: { orderId: string; mode: 'remove' | 'waive'; actor: string }): Promise<Result> {
  const current = await prisma.orderReturn.findUnique({ where: { orderId: params.orderId } });
  if (!current || current.feeStatus === 'NONE') return { ok: false, message: 'No hay cobro que quitar.' };
  if (current.feeStatus === 'PAID') return { ok: false, message: 'El cliente ya pagó: si corresponde, reembolsa desde Mercado Pago.' };

  await prisma.orderReturn.update({
    where: { id: current.id },
    data: {
      feeStatus: params.mode === 'waive' ? 'WAIVED' : 'NONE',
      feePreferenceId: null,
      ...(params.mode === 'remove' ? { feeAmount: 0, feeToken: null } : {}),
    },
  });
  await logOrderEvent({
    orderId: params.orderId,
    type: 'return_fee',
    message: params.mode === 'waive' ? 'Envío de devolución marcado sin cargo.' : 'Cobro de envío de devolución eliminado.',
    actor: params.actor,
  });
  return { ok: true, message: params.mode === 'waive' ? 'Marcado sin cargo.' : 'Cobro eliminado.' };
}

/** Devolución con cobro abierto, buscada por el token del enlace público. */
export async function findReturnByToken(token: string) {
  if (!token || token.length < 16 || token.length > 64) return null;
  return prisma.orderReturn.findUnique({
    where: { feeToken: token },
    include: { order: { include: { items: true } } },
  });
}

/** Arma la preferencia de Mercado Pago y devuelve la URL para pagar. */
export async function startReturnFeeCheckout(token: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const ret = await findReturnByToken(token);
  if (!ret) return { ok: false, message: 'Enlace de pago no válido.' };
  if (ret.feeStatus === 'PAID') return { ok: false, message: 'Este envío ya está pagado.' };
  if (ret.feeStatus !== 'PENDING' || ret.feeAmount <= 0) return { ok: false, message: 'Este envío no tiene un cobro pendiente.' };

  const pref = await createReturnFeePreference({
    returnId: ret.id,
    token,
    orderNumber: ret.order.number,
    title: ret.feeLabel || DEFAULT_FEE_LABEL,
    amount: ret.feeAmount,
    payer: { name: ret.order.firstName, surname: ret.order.lastName, email: ret.order.email },
  });
  await prisma.orderReturn.update({ where: { id: ret.id }, data: { feePreferenceId: pref.id } });
  return { ok: true, url: pref.initPoint };
}

/** Lo que informa el webhook de Mercado Pago sobre un pago de envío de devolución. */
export async function applyReturnFeePayment(returnId: string, payment: MpPaymentInfo) {
  const ret = await prisma.orderReturn.findUnique({ where: { id: returnId }, include: { order: true } });
  if (!ret) {
    console.warn('[mp-webhook] pago de devolución sin registro', payment.id, returnId);
    return;
  }
  if (ret.feePaymentId === payment.id && (ret.feeStatus === 'PAID') === (payment.status === 'APPROVED')) return;

  await logOrderEvent({
    orderId: ret.orderId,
    type: 'return_fee_payment',
    message: `Mercado Pago informó el pago ${payment.id} del envío de devolución como ${payment.status}${
      payment.statusDetail ? ` (${payment.statusDetail})` : ''
    }.`,
    actor: 'Mercado Pago',
    payload: { paymentId: payment.id, status: payment.status, amount: payment.transactionAmount },
  });

  if (payment.status === 'APPROVED') {
    const changed = await prisma.orderReturn.updateMany({
      where: { id: ret.id, NOT: { feeStatus: 'PAID' } },
      data: { feeStatus: 'PAID', feePaymentId: payment.id, feePaidAt: new Date() },
    });
    if (changed.count) {
      await sendAdminReturnFeePaid({
        number: ret.order.number,
        email: ret.order.email,
        amount: payment.transactionAmount ?? ret.feeAmount,
        orderId: ret.orderId,
      }).catch(() => {});
    }
    return;
  }

  // Un pago ya acreditado que se revierte vuelve a quedar pendiente.
  if (
    ret.feeStatus === 'PAID' &&
    ret.feePaymentId === payment.id &&
    (payment.status === 'REFUNDED' || payment.status === 'CHARGED_BACK' || payment.status === 'CANCELLED')
  ) {
    await prisma.orderReturn.update({
      where: { id: ret.id },
      data: { feeStatus: 'PENDING', feePaidAt: null },
    });
  }
}
