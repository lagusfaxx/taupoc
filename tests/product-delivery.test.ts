import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { prisma } from '../src/lib/db';
import { productDeliveryEstimates } from '../src/lib/product-delivery';

if (
  !process.env.DATABASE_URL?.includes('/taupoc_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Use a dedicated local taupoc_test database.');
process.env.ENVIA_API_KEY = 'test-only';
process.env.ENVIA_CARRIERS = 'dhl';
process.env.ENVIA_ORIGIN_STREET = 'Prueba';
process.env.ENVIA_ORIGIN_POSTAL_CODE = '8320000';
process.env.ENVIA_ORIGIN_PHONE = '123456789';
const original = globalThis.fetch;
const quotes: {
  destination: { country: string; state: string; postalCode: string };
  packages: { weight: number }[];
}[] = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const json = (data: unknown) => new Response(JSON.stringify(data));
  if (url.hostname === 'queries.envia.com' && url.pathname === '/country')
    return json({ data: [{ code: 'PA', name: 'Panamá' }] });
  if (url.hostname === 'queries.envia.com' && url.pathname === '/state')
    return json({ data: [{ code: '08', name: 'Panamá' }] });
  if (url.hostname === 'geocodes.envia.com')
    return json([
      { state: { name: 'Panamá', code: { '2digit': '08' } }, locality: 'Ciudad de Panamá' },
    ]);
  assert.equal(url.hostname, 'api-test.envia.com');
  assert.equal(url.pathname, '/ship/rate/');
  const body = JSON.parse(String(init?.body));
  quotes.push(body);
  return json({
    data: [
      {
        carrier: 'dhl',
        service: 'express',
        serviceDescription: 'Express',
        totalPrice: 30000,
        currency: 'CLP',
        deliveryEstimate:
          body.destination.postalCode === '9999' ? 'Por confirmar' : '3 - 5 business days',
      },
    ],
  });
};

test('product estimates use actual stock, weight and Envia services', async (t) => {
  const tag = `delivery-${randomUUID()}`;
  const ids: string[] = [];
  const destination = {
    country: 'PA',
    countryName: 'Panamá',
    city: 'Ciudad de Panamá',
    state: 'PA-8',
    stateName: 'Panamá',
    postalCode: '0801',
  };
  try {
    for (const [i, weight] of [180, 199, 400, 500].entries()) {
      const product = await prisma.product.create({
        data: {
          name: tag,
          slug: `${tag}-${i}`,
          modelCode: `${tag}-${i}`,
          status: i === 3 ? 'COMING_SOON' : 'ACTIVE',
          basePrice: 119000,
          weightGrams: weight,
          colors: { create: { name: 'Negro', slug: 'negro' } },
        },
        include: { colors: true },
      });
      ids.push(product.id);
      await prisma.variant.create({
        data: {
          productId: product.id,
          colorId: product.colors[0].id,
          sku: `${tag}-${i}`,
          size: '24',
          stock: i === 2 ? 0 : 10,
        },
      });
    }
    await t.test(
      'same destination and billable weight coalesce across products and parallel requests',
      async () => {
        const [first, second] = await Promise.all([
          productDeliveryEstimates(ids, destination),
          productDeliveryEstimates(ids, destination),
        ]);
        assert.equal(quotes.length, 1);
        assert.equal(quotes[0].packages[0].weight, 0.2);
        assert.equal(quotes[0].destination.country, 'PA');
        assert.equal(quotes[0].destination.state, '08');
        assert.deepEqual(first, second);
        assert.equal(first[ids[0]]?.days, '3–5 días hábiles');
        assert.deepEqual(first[ids[0]], first[ids[1]]);
        assert.equal(first[ids[2]], undefined);
        assert.equal(first[ids[3]], undefined);
        await productDeliveryEstimates([ids[0]], destination);
        assert.equal(quotes.length, 1);
      },
    );
    await t.test(
      'Chile, incomplete destinations and hidden products do not trigger quotes',
      async () => {
        assert.deepEqual(
          await productDeliveryEstimates(ids, { ...destination, country: 'CL' }),
          {},
        );
        assert.deepEqual(
          await productDeliveryEstimates(ids, { ...destination, postalCode: '' }),
          {},
        );
        assert.deepEqual(
          await productDeliveryEstimates(ids, { ...destination, country: 'ZZ' }),
          {},
        );
        assert.deepEqual(await productDeliveryEstimates(['missing-product'], destination), {});
        assert.equal(quotes.length, 1);
      },
    );
    await t.test(
      'missing provider duration returns unknown instead of a made-up estimate',
      async () => {
        const results = await productDeliveryEstimates([ids[0]], {
          ...destination,
          postalCode: '9999',
        });
        assert.equal(results[ids[0]], null);
        assert.equal(quotes.length, 2);
      },
    );
    await t.test(
      'reserved stock is not promised for delivery, even with a cached estimate',
      async () => {
        await prisma.variant.updateMany({ where: { productId: ids[0] }, data: { reserved: 10 } });
        assert.deepEqual(await productDeliveryEstimates([ids[0]], destination), {});
        assert.equal(quotes.length, 2);
      },
    );
  } finally {
    globalThis.fetch = original;
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
