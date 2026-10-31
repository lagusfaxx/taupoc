import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { notifyOrderStatus } from '../src/lib/order-ops';

if (!process.env.DATABASE_URL?.includes('/taupoc_test')) throw new Error('Use the dedicated taupoc_test database.');
process.env.RESEND_API_KEY = 'local-test-stub';
const sent: { to: string[]; subject: string; html: string }[] = [];
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.resend.com/emails');
  sent.push(JSON.parse(String(options?.body)));
  return new Response('{}', { status: 200 });
};

const tag = `mail-${randomUUID()}`;

async function order(storefront: 'CL' | 'INTL') {
  return prisma.order.create({
    data: {
      number: `${tag}-${storefront}`,
      storefront,
      email: `${storefront.toLowerCase()}@example.invalid`,
      firstName: 'Ana',
      subtotal: 147000,
      shippingTotal: 30000,
      total: 177000,
      country: storefront === 'INTL' ? 'MX' : 'CL',
      city: storefront === 'INTL' ? 'Ciudad de México' : 'Santiago',
      chargedCurrency: storefront === 'INTL' ? 'USD' : null,
      chargedCents: storefront === 'INTL' ? 17900 : null,
      shippingCarrier: 'DHL',
      trackingNumber: '1234567890',
      trackingUrl: 'https://www.dhl.com/track?id=1234567890',
      items: {
        create: { productName: 'R-SKIN Jammer', colorName: 'Negro', size: '24', sku: tag, unitPrice: 147000, quantity: 1, lineTotal: 147000 },
      },
    },
  });
}

test('correos al cliente según la tienda del pedido', async (t) => {
  try {
    const intl = await order('INTL');
    const cl = await order('CL');

    await t.test('taupoc.lat: en dólares, su marca y sin "Chile"', async () => {
      sent.length = 0;
      await notifyOrderStatus(intl.id, 'SHIPPED', 'test');
      assert.equal(sent.length, 1);
      const m = sent[0];
      assert.match(m.subject, /va en camino/);
      assert.match(m.html, /US\$ 179/);
      assert.match(m.html, /taupoc\.lat/);
      assert.match(m.html, /1234567890/);
      assert.doesNotMatch(m.html, /chile|\$147\.000|\$177\.000/i);
    });

    await t.test('taupoc.cl: el correo de siempre', async () => {
      sent.length = 0;
      await notifyOrderStatus(cl.id, 'SHIPPED', 'test');
      assert.equal(sent.length, 1);
      // La plantilla oscura de taupoc.cl, sin montos en dólares.
      assert.match(sent[0].html, /color-scheme" content="dark"/);
      assert.doesNotMatch(sent[0].html, /US\$/);
    });

    await t.test('pedido pendiente de taupoc.lat: sin correo', async () => {
      sent.length = 0;
      await notifyOrderStatus(intl.id, 'PENDING', 'test');
      assert.equal(sent.length, 0);
    });
  } finally {
    await prisma.order.deleteMany({ where: { number: { startsWith: tag } } });
    await prisma.$disconnect();
  }
});
