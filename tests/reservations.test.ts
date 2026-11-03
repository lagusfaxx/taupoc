import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import {
  OutOfStockError,
  releaseExpiredReservations,
  releaseOrderReservation,
  reserveOrderStock,
} from '../src/lib/reservations';
import { commitStockForOrder } from '../src/lib/inventory';
import { changeOrderStatus } from '../src/lib/order-ops';
import { settlePaypalOrder } from '../src/lib/paypal-settle';

// Run only against a dedicated local database, never against the shop.
if (!process.env.DATABASE_URL?.includes('/taupoc_test'))
  throw new Error('Use the dedicated taupoc_test database.');
process.env.RESEND_API_KEY = 'local-test-stub';
process.env.PAYPAL_CLIENT_ID = 'test';
process.env.PAYPAL_CLIENT_SECRET = 'test';

// Correo y PayPal se simulan; cuenta cuántas capturas pidió la tienda.
let captures = 0;
let paypalReference = '';
globalThis.fetch = async (url) => {
  const href = String(url);
  if (href === 'https://api.resend.com/emails') return new Response('{}', { status: 200 });
  if (href.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'tok' });
  if (href.endsWith('/capture')) {
    captures++;
    await new Promise((r) => setTimeout(r, 50));
    return Response.json({
      id: 'x',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: paypalReference,
          payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' } }] },
        },
      ],
    });
  }
  throw new Error(`fetch inesperado: ${href}`);
};

const tag = `res-${randomUUID()}`;

async function variantWithStock(stock: number) {
  const slug = `${tag}-${randomUUID().slice(0, 8)}`;
  const product = await prisma.product.create({
    data: {
      slug,
      name: 'Traje de prueba',
      modelCode: slug,
      basePrice: 10000,
      status: 'ACTIVE',
      colors: { create: { name: 'Azul', slug: 'azul' } },
    },
    include: { colors: true },
  });
  return prisma.variant.create({
    data: { productId: product.id, colorId: product.colors[0].id, size: '28', sku: slug, stock },
  });
}

async function pendingOrder(variantId: string, quantity = 1, extra: Record<string, unknown> = {}) {
  const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
  return prisma.order.create({
    data: {
      number: `${tag}-${randomUUID().slice(0, 8)}`,
      email: 'test@example.invalid',
      firstName: 'Cliente',
      subtotal: 10000 * quantity,
      total: 10000 * quantity,
      ...extra,
      items: {
        create: {
          variantId,
          productId: v.productId,
          productName: 'Traje de prueba',
          colorName: 'Azul',
          size: v.size,
          sku: v.sku,
          unitPrice: 10000,
          quantity,
          lineTotal: 10000 * quantity,
        },
      },
    },
  });
}

const inFuture = () => new Date(Date.now() + 15 * 60 * 1000);
const reserve = (orderId: string, until = inFuture()) =>
  prisma.$transaction((tx) => reserveOrderStock(tx, orderId, until));
const variant = (id: string) => prisma.variant.findUniqueOrThrow({ where: { id } });
const order = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

test('reserva de stock', async (t) => {
  try {
    await t.test('dos compras simultáneas de la última unidad: gana una sola', async () => {
      const v = await variantWithStock(1);
      const orders = await Promise.all(Array.from({ length: 6 }, () => pendingOrder(v.id)));
      const results = await Promise.allSettled(orders.map((o) => reserve(o.id)));
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');
      assert.equal(ok.length, 1);
      assert.equal(failed.length, 5);
      for (const f of failed) assert.ok((f as PromiseRejectedResult).reason instanceof OutOfStockError);
      const after = await variant(v.id);
      assert.equal(after.stock, 1);
      assert.equal(after.reserved, 1);
      // Los perdedores no quedan marcados como reservados.
      const marked = await prisma.order.count({ where: { id: { in: orders.map((o) => o.id) }, stockReserved: true } });
      assert.equal(marked, 1);
    });

    await t.test('pedido con varias unidades: si una no alcanza no se aparta nada', async () => {
      const a = await variantWithStock(2);
      const b = await variantWithStock(0);
      const o = await pendingOrder(a.id, 2);
      const vb = await variant(b.id);
      await prisma.orderItem.create({
        data: {
          orderId: o.id,
          variantId: b.id,
          productId: vb.productId,
          productName: 'Traje de prueba',
          colorName: 'Azul',
          size: '28',
          sku: vb.sku,
          unitPrice: 10000,
          quantity: 1,
          lineTotal: 10000,
        },
      });
      await assert.rejects(reserve(o.id), OutOfStockError);
      assert.equal((await variant(a.id)).reserved, 0);
      assert.equal((await order(o.id)).stockReserved, false);
    });

    await t.test('el pago confirmado convierte la reserva en venta', async () => {
      const v = await variantWithStock(3);
      const o = await pendingOrder(v.id, 2);
      await reserve(o.id);
      await commitStockForOrder(o.id);
      const after = await variant(v.id);
      assert.equal(after.stock, 1);
      assert.equal(after.reserved, 0);
      const done = await order(o.id);
      assert.equal(done.stockReserved, false);
      assert.equal(done.stockCommitted, true);
      // Repetir el aviso de pago no descuenta dos veces.
      await commitStockForOrder(o.id);
      assert.equal((await variant(v.id)).stock, 1);
    });

    await t.test('marcar pagado desde el panel también consume la reserva', async () => {
      const v = await variantWithStock(2);
      const o = await pendingOrder(v.id);
      await reserve(o.id);
      const result = await changeOrderStatus({ orderId: o.id, status: 'PAID', actor: 'test', notify: false });
      assert.equal(result.ok, true);
      const after = await variant(v.id);
      assert.equal(after.stock, 1);
      assert.equal(after.reserved, 0);
    });

    await t.test('cancelar un pedido pendiente suelta la reserva', async () => {
      const v = await variantWithStock(1);
      const o = await pendingOrder(v.id);
      await reserve(o.id);
      await changeOrderStatus({ orderId: o.id, status: 'CANCELLED', actor: 'test', notify: false });
      const after = await variant(v.id);
      assert.equal(after.stock, 1);
      assert.equal(after.reserved, 0);
    });

    await t.test('la reserva vencida se libera y el pedido sigue pendiente', async () => {
      const v = await variantWithStock(1);
      const o = await pendingOrder(v.id);
      await reserve(o.id, new Date(Date.now() - 1000));
      const released = await releaseExpiredReservations();
      assert.ok(released >= 1);
      assert.equal((await variant(v.id)).reserved, 0);
      const after = await order(o.id);
      assert.equal(after.status, 'PENDING');
      assert.equal(after.stockReserved, false);
      const events = await prisma.orderEvent.count({ where: { orderId: o.id, type: 'reservation_expired' } });
      assert.equal(events, 1);
    });

    await t.test('un pago en revisión mantiene su reserva aunque venza', async () => {
      const v = await variantWithStock(1);
      const o = await pendingOrder(v.id, 1, { paymentStatus: 'IN_PROCESS' });
      await reserve(o.id, new Date(Date.now() - 1000));
      await releaseExpiredReservations();
      assert.equal((await variant(v.id)).reserved, 1);
      await prisma.$transaction((tx) => releaseOrderReservation(tx, o.id));
    });

    await t.test('vencimiento y pago al mismo tiempo no liberan dos veces', async () => {
      const v = await variantWithStock(2);
      const other = await pendingOrder(v.id);
      await reserve(other.id); // otra compra con su reserva vigente
      const o = await pendingOrder(v.id);
      await reserve(o.id, new Date(Date.now() - 1000));
      await Promise.all([releaseExpiredReservations(), commitStockForOrder(o.id)]);
      const after = await variant(v.id);
      assert.equal(after.stock, 1);
      assert.equal(after.reserved, 1, 'la reserva de la otra compra sigue intacta');
    });

    await t.test('pago tardío sin stock: se descuenta igual y queda la alerta', async () => {
      const v = await variantWithStock(1);
      const late = await pendingOrder(v.id);
      await reserve(late.id, new Date(Date.now() - 1000));
      await releaseExpiredReservations();
      const winner = await pendingOrder(v.id);
      await reserve(winner.id);
      await commitStockForOrder(winner.id);
      await commitStockForOrder(late.id);
      assert.equal((await variant(v.id)).stock, -1);
      const alert = await prisma.orderEvent.count({ where: { orderId: late.id, type: 'oversold' } });
      assert.equal(alert, 1);
    });

    await t.test('PayPal: retorno y webhook a la vez cobran una sola vez', async () => {
      const v = await variantWithStock(1);
      const o = await pendingOrder(v.id, 1, { paymentMethod: 'PAYPAL', paypalOrderId: `PP-${tag}-1` });
      await reserve(o.id);
      paypalReference = o.id;
      captures = 0;
      const [a, b] = await Promise.all([
        settlePaypalOrder(`PP-${tag}-1`, 'PayPal'),
        settlePaypalOrder(`PP-${tag}-1`, 'PayPal (webhook)'),
      ]);
      assert.equal(a.outcome, 'paid');
      assert.equal(b.outcome, 'paid');
      assert.equal(captures, 1);
      const after = await variant(v.id);
      assert.equal(after.stock, 0);
      assert.equal(after.reserved, 0);
      assert.equal((await order(o.id)).paymentStatus, 'APPROVED');
    });

    await t.test('PayPal: aprobado tras vencer la reserva y sin stock, no se captura', async () => {
      const v = await variantWithStock(1);
      const late = await pendingOrder(v.id, 1, { paymentMethod: 'PAYPAL', paypalOrderId: `PP-${tag}-2` });
      await reserve(late.id, new Date(Date.now() - 1000));
      await releaseExpiredReservations();
      const winner = await pendingOrder(v.id);
      await reserve(winner.id);
      captures = 0;
      const result = await settlePaypalOrder(`PP-${tag}-2`, 'PayPal (webhook)');
      assert.equal(result.outcome, 'out_of_stock');
      assert.equal(captures, 0);
      assert.equal((await order(late.id)).paymentStatus, 'PENDING');
      assert.equal((await variant(v.id)).reserved, 1);
    });

    await t.test('PayPal: aprobado tras vencer la reserva con stock libre, se vuelve a apartar y se cobra', async () => {
      const v = await variantWithStock(1);
      const late = await pendingOrder(v.id, 1, { paymentMethod: 'PAYPAL', paypalOrderId: `PP-${tag}-3` });
      await reserve(late.id, new Date(Date.now() - 1000));
      await releaseExpiredReservations();
      paypalReference = late.id;
      const result = await settlePaypalOrder(`PP-${tag}-3`, 'PayPal (webhook)');
      assert.equal(result.outcome, 'paid');
      const after = await variant(v.id);
      assert.equal(after.stock, 0);
      assert.equal(after.reserved, 0);
    });
  } finally {
    await prisma.order.deleteMany({ where: { number: { startsWith: tag } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  }
});
