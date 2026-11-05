import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

if (
  process.env.INTL_DELIVERY_TEST !== '1' ||
  !process.env.INTL_TEST_RECORDS ||
  !process.env.DATABASE_URL?.includes('/taupoc_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Use an isolated local delivery test.');
const original = globalThis.fetch;
const json = (data) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : (input.url ?? input.href));
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return original(input, init);
  if (url.hostname === 'queries.envia.com' && url.pathname === '/country')
    return json({
      data: [
        { code: 'PA', name: 'Panamá' },
        { code: 'US', name: 'Estados Unidos' },
      ],
    });
  if (url.hostname === 'queries.envia.com' && url.pathname === '/state')
    return json({
      data: [
        { code: '08', name: 'Panamá' },
        { code: '04', name: 'Chiriquí' },
      ],
    });
  if (url.hostname === 'geocodes.envia.com')
    return json([
      {
        state: {
          name: url.pathname.endsWith('0426') ? 'Chiriquí' : 'Panamá',
          code: { '2digit': url.pathname.endsWith('0426') ? '04' : '08' },
        },
        locality: url.pathname.endsWith('0426') ? 'David' : 'Ciudad de Panamá',
      },
    ]);
  if (url.hostname === 'api-test.envia.com' && url.pathname === '/ship/rate/') {
    const body = JSON.parse(init.body);
    appendFileSync(
      join(process.env.INTL_TEST_RECORDS, 'quotes.jsonl'),
      JSON.stringify(body) + '\n',
    );
    return json({
      data: [
        {
          carrier: 'dhl',
          service: 'express',
          serviceDescription: 'Express',
          totalPrice: 30000,
          currency: 'CLP',
          deliveryEstimate:
            body.destination.postalCode === '9999'
              ? 'Por confirmar'
              : body.destination.postalCode === '0426'
                ? '5 - 7 business days'
                : '3 - 5 business days',
        },
      ],
    });
  }
  throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
};
