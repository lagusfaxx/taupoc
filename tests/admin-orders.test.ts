import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { createAdminOrder } from '../src/lib/admin-orders';
import { changeOrderStatus, saveOrderTracking, resolveTransfer } from '../src/lib/order-ops';
import { commitStockForOrder, restoreStockForOrder } from '../src/lib/inventory';
import { sizeDemand } from '../src/lib/reports';

// Run only against a dedicated local database, never against the shop.
if (!process.env.DATABASE_URL?.includes('/taupoc_test'))
  throw new Error('Use the dedicated taupoc_test database.');
process.env.RESEND_API_KEY = 'local-test-stub';
const messages: { subject: string; html: string }[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.resend.com/emails');
  messages.push(JSON.parse(String(options?.body)));
  return new Response('{}', { status: 200 });
};

test('orders and size demand against PostgreSQL', async (t) => {
  const tag = `test-${randomUUID()}`;
  const product = await prisma.product.create({
    data: {
      slug: tag,
      name: 'Traje de prueba',
      modelCode: tag,
      basePrice: 10000,
      status: 'ACTIVE',
      colors: { create: { name: 'Azul', slug: 'azul' } },
    },
    include: { colors: true },
  });
  const variant = await prisma.variant.create({
    data: {
      productId: product.id,
      colorId: product.colors[0].id,
      size: '24',
      sku: tag,
      stock: 0,
      active: false,
    },
  });
  const input = {
    creationKey: randomUUID(),
    email: 'test@example.invalid',
    firstName: 'Cliente',
    lastName: 'Prueba',
    phone: '912345678',
    status: 'PAID',
    delivery: 'pickup',
    shippingLabel: 'Retiro',
    shippingTotal: 1000,
    discountTotal: 500,
    items: [{ variantId: variant.id, quantity: 2 }],
  };
  const ids: string[] = [];
  try {
    await t.test(
      'creates a paid order without stock, snapshots prices, sends the normal email',
      async () => {
        const id = await createAdminOrder(input, 'admin@example.invalid');
        ids.push(id);
        const o = await prisma.order.findUniqueOrThrow({
          where: { id },
          include: { items: true, events: true },
        });
        assert.equal(o.total, 20500);
        assert.equal(o.items[0].lineTotal, 20000);
        assert.equal(o.paymentStatus, 'APPROVED');
      assert.equal(o.paymentMethod, 'MANUAL');
        assert.ok(o.paidAt);
        assert.equal(
          (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
          -2,
        );
        assert.ok(messages[0].subject.includes('Pago confirmado'));
        assert.ok(messages[0].html.includes(o.number));
        assert.ok(messages[0].html.includes('Traje de prueba'));
        assert.ok(
          o.events.some((e) => e.type === 'status_email' && e.message.includes('aceptado')),
        );
      },
    );
    await t.test('concurrent retries do not duplicate orders, stock or emails', async () => {
      const count = messages.length;
      const attempts = await Promise.all([
        createAdminOrder(input, 'admin'),
        createAdminOrder(input, 'admin'),
      ]);
      assert.deepEqual(attempts, [ids[0], ids[0]]);
      assert.equal(messages.length, count);
      assert.equal(
        await prisma.inventoryMovement.count({ where: { orderId: ids[0], type: 'SALE' } }),
        1,
      );
      await Promise.all([commitStockForOrder(ids[0]), commitStockForOrder(ids[0])]);
      assert.equal(
        (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
        -2,
      );
    });
    await t.test(
      'processing and shipment use normal status emails and never deduct twice',
      async () => {
        await Promise.all([
          changeOrderStatus({ orderId: ids[0], status: 'PROCESSING', actor: 'admin' }),
          changeOrderStatus({ orderId: ids[0], status: 'PROCESSING', actor: 'admin' }),
        ]);
        assert.equal(messages.filter((m) => m.subject.includes('preparación')).length, 1);
        await saveOrderTracking({
          orderId: ids[0],
          trackingNumber: 'TEST12345',
          carrier: 'Chilexpress',
          markShipped: true,
          actor: 'admin',
        });
        assert.equal(
          (await prisma.order.findUniqueOrThrow({ where: { id: ids[0] } })).status,
          'SHIPPED',
        );
        assert.equal(
          (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
          -2,
        );
        assert.ok(messages.some((m) => m.html.includes('TEST12345')));
      },
    );
    await t.test(
      'cancellation and repeat restoration return stock once and exclude sale',
      async () => {
        await changeOrderStatus({ orderId: ids[0], status: 'CANCELLED', actor: 'admin' });
        await Promise.all([restoreStockForOrder(ids[0]), restoreStockForOrder(ids[0])]);
        assert.equal(
          (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
          0,
        );
        const row = (await sizeDemand(new Date(0), new Date())).variants.find((r) => r.sku === tag);
        assert.equal(row, undefined);
      },
    );
    await t.test(
      'invalid totals, missing variants and duplicate lines create nothing',
      async () => {
        for (const changes of [
          { discountTotal: 999999 },
          { items: [{ variantId: 'missing', quantity: 1 }] },
          { items: [input.items[0], input.items[0]] },
          { status: 'SHIPPED' },
          { items: [{ variantId: variant.id, quantity: 1.5 }] },
        ]) {
          await assert.rejects(() =>
            createAdminOrder({ ...input, creationKey: randomUUID(), ...changes }, 'admin'),
          );
        }
        assert.equal(await prisma.order.count({ where: { items: { some: { sku: tag } } } }), 1);
      },
    );
    await t.test('pending creation leaves stock untouched; marking paid commits it', async () => {
      const id = await createAdminOrder(
        { ...input, creationKey: randomUUID(), status: 'PENDING' },
        'admin',
      );
      ids.push(id);
      assert.equal(
        (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
        0,
      );
      assert.ok(messages.at(-1)?.subject.includes('recibido'));
      await changeOrderStatus({ orderId: id, status: 'PAID', actor: 'admin' });
      assert.equal(
        (await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
        -2,
      );
    });
    await t.test('manual sales are included in the existing size demand report', async () => {
      const r=(await sizeDemand(new Date(0),new Date())).variants.find(r=>r.variantId===variant.id)!;
      assert.equal(r.sold,2);
      assert.equal(r.onlineSold,0);
    });
    await t.test('transfer confirmation preserves coupon accounting and status emails', async () => {
      const coupon=await prisma.coupon.create({data:{code:tag,type:'FIXED',value:100}});
      try {
        const id=await createAdminOrder({...input,creationKey:randomUUID(),status:'PENDING'},'admin');ids.push(id);
        await prisma.order.update({where:{id},data:{paymentMethod:'TRANSFER',couponId:coupon.id}});
        const result=await resolveTransfer({orderId:id,decision:'confirm',actor:'admin'});
        assert.equal(result.ok,true);
        assert.equal((await prisma.coupon.findUniqueOrThrow({where:{id:coupon.id}})).usedCount,1);
        await changeOrderStatus({orderId:id,status:'PAID',actor:'admin'});
        assert.equal((await prisma.coupon.findUniqueOrThrow({where:{id:coupon.id}})).usedCount,1);
      } finally { await prisma.coupon.delete({where:{id:coupon.id}}); }
    });
  } finally {
    await prisma.inventoryMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.product.delete({ where: { id: product.id } });
    globalThis.fetch = originalFetch;
    await prisma.$disconnect();
  }
});
