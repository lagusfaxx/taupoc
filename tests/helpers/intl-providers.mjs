// Preloaded only by browser-intl-coupons.mts into its isolated Next process.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

if (
  process.env.INTL_COUPON_TEST !== '1' ||
  !process.env.INTL_TEST_RECORDS ||
  !process.env.DATABASE_URL?.includes('/taupoc_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
) {
  throw new Error('Provider stubs require an isolated local coupon test.');
}
const original = globalThis.fetch;
const json = (data) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : (input.url ?? input.href));
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return original(input, init);
  if (url.hostname === 'queries.envia.com' && url.pathname === '/country')
    return json({ data: [{ code: 'US', name: 'Estados Unidos' }] });
  if (url.hostname === 'queries.envia.com' && url.pathname === '/state')
    return json({ data: [{ code: 'NY', name: 'New York' }] });
  if (url.hostname === 'geocodes.envia.com') return json([]);
  if (url.hostname === 'api-test.envia.com' && url.pathname === '/ship/rate/')
    return json({
      data: [
        {
          carrier: 'dhl',
          service: 'express',
          serviceDescription: 'Express',
          totalPrice: 30000,
          currency: 'CLP',
          deliveryEstimate: '3–5 días',
        },
      ],
    });
  if (url.hostname === 'api-m.sandbox.paypal.com') {
    if (url.pathname === '/v1/oauth2/token') return json({ access_token: 'test-only' });
    if (url.pathname === '/v2/checkout/orders') {
      const id = randomUUID();
      const body = JSON.parse(init.body);
      writeFileSync(join(process.env.INTL_TEST_RECORDS, `${id}.json`), JSON.stringify(body));
      return json({
        id,
        links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/test/${id}` }],
      });
    }
    const match = url.pathname.match(/^\/v2\/checkout\/orders\/([a-f0-9-]+)\/capture$/);
    if (match) {
      const order = JSON.parse(
        readFileSync(join(process.env.INTL_TEST_RECORDS, `${match[1]}.json`), 'utf8'),
      );
      return json({
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: order.purchase_units[0].reference_id,
            payments: {
              captures: [
                {
                  id: `capture-${match[1]}`,
                  status: 'COMPLETED',
                  amount: order.purchase_units[0].amount,
                },
              ],
            },
          },
        ],
      });
    }
  }
  if (url.hostname === 'api.resend.com' && url.pathname === '/emails') {
    appendFileSync(join(process.env.INTL_TEST_RECORDS, 'mail.jsonl'), `${init.body}\n`);
    return json({ id: randomUUID() });
  }
  throw new Error(`Unexpected external request in coupon test: ${url.origin}${url.pathname}`);
};
