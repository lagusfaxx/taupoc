import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

if (
  !process.env.DATABASE_URL?.includes('/taupoc_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Use a dedicated local taupoc_test database.');
const db = new PrismaClient();
const tag = `delivery-${randomUUID()}`;
const records = mkdtempSync(join(tmpdir(), 'intl-delivery-'));
const base = 'http://localhost:3119';
const cl = 'http://127.0.0.1:3119';
const log = createWriteStream(join(records, 'server.log'));
const server = spawn(
  process.execPath,
  [
    '--import',
    resolve('tests/helpers/delivery-providers.mjs'),
    'node_modules/next/dist/bin/next',
    'start',
    '-p',
    '3119',
  ],
  {
    env: {
      ...process.env,
      INTL_DELIVERY_TEST: '1',
      INTL_TEST_RECORDS: records,
      STORE_INTL_HOSTS: 'localhost',
      SITE_URL_INTL: base,
      SITE_URL_CL: cl,
      NEXT_PUBLIC_SITE_URL: cl,
      ENVIA_MODE: 'test',
      ENVIA_API_KEY: tag,
      ENVIA_CARRIERS: 'dhl',
      ENVIA_ORIGIN_STREET: 'Prueba',
      ENVIA_ORIGIN_POSTAL_CODE: '8320000',
      ENVIA_ORIGIN_PHONE: '123456789',
      PAYPAL_CLIENT_ID: '',
      PAYPAL_CLIENT_SECRET: '',
      RESEND_API_KEY: '',
      SMTP_HOST: '',
      MP_ACCESS_TOKEN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
server.stdout.pipe(log);
server.stderr.pipe(log);
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const originalSite = await db.setting.findUnique({ where: { key: 'site' } });
let productId: string | undefined;
let fxId: string | undefined;
let cartId: string | undefined;
const errors: string[] = [];
const requests: { kind: string; latitude?: string | null; longitude?: string | null }[] = [];
const quoteCalls = () =>
  existsSync(join(records, 'quotes.jsonl'))
    ? readFileSync(join(records, 'quotes.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((s) => JSON.parse(s))
    : [];
function feature(city = 'Ciudad de Panamá', postcode = '0801') {
  return {
    properties: {
      feature_type: 'place',
      name: city,
      full_address: `${city}, Panamá`,
      context: {
        country: { country_code: 'PA', name: 'Panamá' },
        region: {
          name: city === 'David' ? 'Chiriquí' : 'Panamá',
          region_code_full: city === 'David' ? 'PA-4' : 'PA-8',
        },
        ...(postcode ? { postcode: { name: postcode } } : {}),
      },
    },
  };
}
async function customer(
  options: { denied?: boolean; postcode?: string; mapboxFails?: boolean } = {},
) {
  const context = await browser.newContext({
    permissions: options.denied ? [] : ['geolocation'],
    geolocation: { latitude: 8.9824, longitude: -79.5199 },
  });
  // The test cannot send analytics, geocoding or any other request to a real provider.
  await context.route('**/*', (route) =>
    ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await context.route('https://api.mapbox.com/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push({
      kind: url.pathname.endsWith('/reverse') ? 'reverse' : 'forward',
      latitude: url.searchParams.get('latitude'),
      longitude: url.searchParams.get('longitude'),
    });
    if (options.mapboxFails) return route.fulfill({ status: 503, body: '{}' });
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        features: [
          url.pathname.endsWith('/forward')
            ? feature('David', '0426')
            : feature('Ciudad de Panamá', options.postcode ?? '0801'),
        ],
      }),
    });
  });
  await context.addInitScript(
    ({ denied }) => {
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (success, error, options) => {
        sessionStorage.setItem(
          'test-geolocation-count',
          String(Number(sessionStorage.getItem('test-geolocation-count') ?? 0) + 1),
        );
        if (denied) {
          error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
          return;
        }
        original(success, error, options);
      };
    },
    { denied: Boolean(options.denied) },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page };
}

try {
  const site = {
    ...((originalSite?.value as object) ?? {}),
    instagram: 'taupoc.prueba',
    contactEmail: 'contacto@example.invalid',
  };
  await db.setting.upsert({
    where: { key: 'site' },
    create: { key: 'site', value: site },
    update: { value: site },
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error(readFileSync(join(records, 'server.log'), 'utf8'));
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) break;
    } catch {}
    if (i === 99) throw new Error('Test server did not start.');
    await new Promise((r) => setTimeout(r, 200));
  }
  const product = await db.product.create({
    data: {
      slug: tag,
      name: 'Jammer de prueba',
      modelCode: tag,
      basePrice: 119000,
      weightGrams: 180,
      status: 'ACTIVE',
      colors: {
        create: [
          { name: 'Negro', slug: 'negro' },
          { name: 'Azul', slug: 'azul' },
        ],
      },
    },
    include: { colors: true },
  });
  productId = product.id;
  let variantId = '';
  for (const color of product.colors) {
    await db.productImage.create({
      data: { productId, colorId: color.id, url: '/icon.svg', width: 1000, height: 1200 },
    });
    const variant = await db.variant.create({
      data: { productId, colorId: color.id, size: '24', sku: `${tag}-${color.slug}`, stock: 10 },
    });
    variantId = variant.id;
  }
  fxId = (
    await db.exchangeRate.create({
      data: {
        clpPerUsd: 1000,
        marginPct: 0,
        vatPct: 19,
        rounding: 'WHOLE',
        effectiveFrom: new Date(),
      },
    })
  ).id;
  const cartToken = randomUUID();
  cartId = (
    await db.cart.create({
      data: { token: cartToken, items: { create: { variantId, quantity: 1 } } },
    })
  ).id;
  const path = `/producto/${tag}-negro`;

  // First entry can be any .lat page, including checkout and a 404.
  for (const entry of ['/', '/carrito', '/checkout', '/catalogo', path, '/pagina-que-no-existe']) {
    const { context, page } = await customer();
    await context.addCookies([
      { name: 'taupoc_cart', value: cartToken, url: base, httpOnly: true },
    ]);
    await page.goto(`${base}${entry}`);
    await page
      .getByRole('status')
      .filter({ hasText: 'Envíos a Ciudad de Panamá, Panamá' })
      .waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('test-geolocation-count')), '1');
    await page.goto(`${base}/carrito`);
    await page
      .getByRole('status')
      .filter({ hasText: 'Envíos a Ciudad de Panamá, Panamá' })
      .waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('test-geolocation-count')), '1');
    await context.close();
  }
  assert.ok(
    requests.some(
      (r) => r.kind === 'reverse' && r.latitude === '8.9824' && r.longitude === '-79.5199',
    ),
  );
  const { context, page } = await customer();
  await page.goto(`${base}/catalogo`);
  await page.getByText('3–5 días hábiles aprox.', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('3–5 días hábiles aprox.', { exact: true }).count(), 2);
  assert.equal(quoteCalls().length, 1);
  assert.equal(quoteCalls()[0].packages[0].weight, 0.2);
  assert.equal(quoteCalls()[0].destination.country, 'PA');
  assert.equal(quoteCalls()[0].destination.state, '08');
  await page.screenshot({ path: join(records, 'catalog-desktop.png'), fullPage: true });
  await page.goto(`${base}${path}`);
  await page.getByText('3–5 días hábiles aprox.', { exact: true }).waitFor();
  assert.match(await page.locator('article').innerText(), /Desde el despacho/);
  await page.screenshot({ path: join(records, 'product-desktop.png'), fullPage: true });
  assert.equal(
    await page
      .locator('footer')
      .getByRole('link', { name: 'Instagram', exact: true })
      .getAttribute('href'),
    'https://instagram.com/taupoc.prueba',
  );
  assert.equal(await page.locator('footer a[href="mailto:contacto@example.invalid"]').count(), 1);
  // Change city using Mapbox suggestions and verify the estimate changes with the locality.
  await page.getByRole('button', { name: 'Cambiar', exact: true }).click();
  await page.getByLabel('Buscar localidad').fill('David');
  await page
    .getByRole('option', { name: 'David, Panamá', exact: true })
    .getByRole('button')
    .click();
  await page.getByRole('button', { name: 'Guardar localidad' }).click();
  await page.getByText('5–7 días hábiles aprox.', { exact: true }).waitFor();
  assert.match(await page.locator('article').innerText(), /Envío a David/);
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('taupoc-intl-delivery')!),
  );
  assert.equal(stored.city, 'David');
  assert.equal('latitude' in stored, false);
  assert.equal('longitude' in stored, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400); // Let the existing cart drawer's viewport transition settle.
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(records, 'product-mobile.png'), fullPage: true });
  // Missing postcode: do not quote or invent a postal code.
  const incomplete = await customer({ postcode: '' });
  await incomplete.page.goto(`${base}${path}`);
  await incomplete.page.getByRole('button', { name: 'Completar', exact: true }).waitFor();
  assert.equal(await incomplete.page.getByText(/días hábiles aprox/).count(), 0);
  await incomplete.page.getByRole('button', { name: 'Completar', exact: true }).click();
  await incomplete.page.getByLabel('Código postal', { exact: true }).fill('0801');
  await incomplete.page.getByRole('button', { name: 'Guardar localidad' }).click();
  await incomplete.page.getByText('3–5 días hábiles aprox.', { exact: true }).waitFor();
  // Denied permission still permits manual location and doesn't re-prompt on refresh.
  const denied = await customer({ denied: true });
  await denied.page.goto(`${base}${path}`);
  await denied.page.getByRole('button', { name: 'Elegir localidad' }).click();
  await denied.page.getByLabel('País', { exact: true }).selectOption('PA');
  await denied.page.getByLabel('Ciudad o localidad').fill('Ciudad de Panamá');
  await denied.page.getByLabel('Código postal', { exact: true }).fill('9999');
  await denied.page.getByRole('button', { name: 'Guardar localidad' }).click();
  await denied.page
    .getByText('Envío a Ciudad de Panamá: plazo por confirmar.', { exact: true })
    .waitFor();
  await denied.page.reload();
  await denied.page.getByRole('status').filter({ hasText: 'Envíos a Ciudad de Panamá' }).waitFor();
  assert.equal(
    await denied.page.evaluate(() => sessionStorage.getItem('test-geolocation-count')),
    '1',
  );
  const failed = await customer({ mapboxFails: true });
  await failed.page.goto(`${base}/carrito`);
  await failed.page
    .getByRole('status')
    .filter({ hasText: 'No pudimos consultar tu ubicación' })
    .waitFor();
  await failed.page.getByRole('button', { name: 'Elegir localidad' }).click();
  await failed.page.getByRole('dialog').waitFor();
  // API validates requests and never trusts supplied weights.
  const invalid = await context.request.post(`${base}/api/intl/entrega`, {
    data: { productIds: [productId], destination: { country: 'PA' }, weightGrams: 1 },
  });
  assert.equal(invalid.status(), 400);
  const domestic = await customer();
  await domestic.page.goto(`${cl}/catalogo`);
  assert.equal(
    await domestic.page.evaluate(() => sessionStorage.getItem('test-geolocation-count')),
    null,
  );
  assert.equal(
    await domestic.page
      .locator('footer')
      .getByRole('link', { name: 'Instagram', exact: true })
      .getAttribute('href'),
    'https://instagram.com/taupoc.prueba',
  );
  assert.equal(
    await domestic.page.locator('footer a[href="mailto:contacto@example.invalid"]').count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS: automatic location on every INTL entry, once per session, Panama ETAs, batched quotes, product/catalog/mobile, manual city, missing postcode, denial, provider failure, unchanged CL and shared footer. Artifacts: ${records}`,
  );
} catch (error) {
  for (const [i, page] of browser
    .contexts()
    .flatMap((c) => c.pages())
    .entries()) {
    console.error(
      `Page ${page.url()}\n${await page
        .locator('body')
        .innerText()
        .catch(() => '')}`,
    );
    await page
      .screenshot({ path: join(records, `failure-${i}.png`), fullPage: true })
      .catch(() => {});
  }
  console.error(`Artifacts: ${records}`);
  throw error;
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await new Promise<void>((r) => {
    if (server.exitCode !== null) r();
    else server.once('exit', () => r());
  });
  log.end();
  if (cartId) await db.cart.delete({ where: { id: cartId } });
  if (productId) await db.product.delete({ where: { id: productId } });
  if (fxId) await db.exchangeRate.delete({ where: { id: fxId } });
  if (originalSite)
    await db.setting.update({ where: { key: 'site' }, data: { value: originalSite.value! } });
  else await db.setting.deleteMany({ where: { key: 'site' } });
  await db.$disconnect();
}
