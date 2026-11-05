import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { chromium, type Page } from 'playwright';

// Requires npm run build and migrations in a dedicated local test database.
if (
  !process.env.DATABASE_URL?.includes('/taupoc_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Use a dedicated local taupoc_test database.');
const db = new PrismaClient();
const tag = `intl-coupon-${randomUUID()}`;
const records = mkdtempSync(join(tmpdir(), 'intl-coupons-'));
const port = 3118;
const base = `http://localhost:${port}`;
const log = createWriteStream(join(records, 'server.log'));
const server = spawn(
  process.execPath,
  [
    '--import',
    resolve('tests/helpers/intl-providers.mjs'),
    'node_modules/next/dist/bin/next',
    'start',
    '-p',
    String(port),
  ],
  {
    env: {
      ...process.env,
      INTL_COUPON_TEST: '1',
      INTL_TEST_RECORDS: records,
      STORE_INTL_HOSTS: 'localhost',
      SITE_URL_INTL: base,
      SITE_URL_CL: `http://127.0.0.1:${port}`,
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
      AUTH_SECRET: 'isolated-coupon-test-secret-with-enough-length',
      PAYPAL_MODE: 'sandbox',
      PAYPAL_CLIENT_ID: 'test-only',
      PAYPAL_CLIENT_SECRET: 'test-only',
      PAYPAL_USD_TO_CLP: '1000',
      PAYPAL_WEBHOOK_ID: '',
      ENVIA_MODE: 'sandbox',
      ENVIA_API_KEY: 'test-only',
      ENVIA_CARRIERS: 'dhl',
      ENVIA_ORIGIN_STREET: 'Prueba',
      ENVIA_ORIGIN_POSTAL_CODE: '8320000',
      ENVIA_ORIGIN_PHONE: '123456789',
      RESEND_API_KEY: 'test-only',
      SMTP_HOST: '',
      MP_ACCESS_TOKEN: '',
      ADMIN_ALERT_EMAIL: '',
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
const errors: string[] = [];
const couponIds: string[] = [];
const cartIds: string[] = [];
let productId: string | undefined;
let rateId: string | undefined;
async function apply(page: Page, code: string) {
  await page.getByLabel('Código de descuento', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar cupón', exact: true }).waitFor();
}
async function total(page: Page, label: string, value: string) {
  await page.waitForFunction(
    ({ label, value }) =>
      [...document.querySelectorAll('dt')].some(
        (el) => el.textContent === label && el.nextElementSibling?.textContent === value,
      ),
    { label, value },
  );
}
try {
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
      status: 'ACTIVE',
      colors: { create: { name: 'Negro', slug: 'negro' } },
    },
    include: { colors: true },
  });
  productId = product.id;
  const variant = await db.variant.create({
    data: {
      productId,
      colorId: product.colors[0].id,
      size: '24',
      sku: tag,
      stock: 20,
      active: true,
    },
  });
  const rate = await db.exchangeRate.create({
    data: {
      clpPerUsd: 1000,
      marginPct: 0,
      vatPct: 19,
      rounding: 'WHOLE',
      effectiveFrom: new Date(),
    },
  });
  rateId = rate.id;
  const coupons = [];
  for (const [suffix, type, value] of [
    ['PCT', 'PERCENT', 10],
    ['FIX', 'FIXED', 10000],
    ['SHIP', 'FREE_SHIPPING', 0],
  ] as const) {
    const coupon = await db.coupon.create({
      data: { code: `${tag}-${suffix}`.toUpperCase(), type, value },
    });
    coupons.push(coupon);
    couponIds.push(coupon.id);
  }
  async function customer(couponCode: string | null = null, cl = false) {
    const token = randomUUID();
    const cart = await db.cart.create({
      data: { token, couponCode, items: { create: { variantId: variant.id, quantity: 2 } } },
    });
    cartIds.push(cart.id);
    const context = await browser.newContext();
    const url = cl ? `http://127.0.0.1:${port}` : base;
    await context.addCookies([
      { name: 'taupoc_cart', value: token, url, httpOnly: true, sameSite: 'Lax' },
    ]);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://www.sandbox.paypal.com/**', (r) =>
      r.fulfill({ body: 'PayPal simulado' }),
    );
    return { page, cart, url };
  }
  async function contact(page: Page, email: string) {
    await page.getByLabel('Correo', { exact: true }).fill(email);
    await page.getByLabel('Nombre', { exact: true }).fill('Ana');
    await page.getByLabel('Apellido', { exact: true }).fill('Prueba');
    await page.locator('[name=phone]').fill('12125551234');
    await page.locator('[name=country]').selectOption('US');
    await page.locator('[name=postalCode]').fill('10001');
    await page.locator('[name=city]').fill('New York');
    await page.locator('[name=street]').fill('Test Street');
    await page.locator('[name=streetNumber]').fill('123');
    await page.locator('[name=duties]').check();
    await page.getByRole('radio').first().waitFor();
  }
  const { page } = await customer();
  await page.goto(`${base}/carrito`);
  await total(page, 'Total sin envío', 'US$ 200');
  await page.getByLabel('Código de descuento').fill('NO-EXISTE');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'no existe' }).waitFor();
  await apply(page, coupons[0].code.toLowerCase());
  await total(page, 'Descuento', '−US$ 20');
  await total(page, 'Total sin envío', 'US$ 180');
  await page.reload();
  await total(page, 'Total sin envío', 'US$ 180');
  await page.getByRole('button', { name: 'Agregar una unidad' }).click();
  await total(page, 'Descuento', '−US$ 30');
  await page.getByRole('button', { name: 'Quitar una unidad' }).click();
  await total(page, 'Total sin envío', 'US$ 180');
  await page.screenshot({ path: join(records, 'cart-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(records, 'cart-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Continuar al pago' }).click();
  await total(page, 'Descuento', '−US$ 20');
  assert.equal(await page.locator('form form').count(), 0);
  await page.getByRole('button', { name: 'Quitar cupón' }).click();
  await total(page, 'Total', 'US$ 200');
  await apply(page, coupons[1].code);
  await total(page, 'Descuento', '−US$ 10');
  await contact(page, `${tag}@example.invalid`);
  await total(page, 'Total', 'US$ 220');
  await page.screenshot({ path: join(records, 'checkout-mobile.png'), fullPage: true });
  // Tampered/stale client total must update the summary and require another confirmation.
  await page.locator('[name=expectedTotalCents]').evaluate((el: HTMLInputElement) => {
    el.value = '1';
  });
  await page.getByRole('button', { name: 'Pagar US$ 220 con PayPal', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'El total cambió' }).waitFor();
  assert.equal(await db.order.count({ where: { email: `${tag}@example.invalid` } }), 0);
  await page.getByRole('button', { name: 'Pagar US$ 220 con PayPal', exact: true }).click();
  await page.waitForURL('https://www.sandbox.paypal.com/**');
  const order = await db.order.findFirstOrThrow({ where: { email: `${tag}@example.invalid` } });
  assert.equal(order.couponId, coupons[1].id);
  assert.equal(order.couponCode, coupons[1].code);
  assert.equal(order.discountTotal, 10000);
  assert.equal(order.chargedCents, 22000);
  assert.equal(order.total, order.subtotal - order.discountTotal + order.shippingTotal);
  const paypal = JSON.parse(readFileSync(join(records, `${order.paypalOrderId}.json`), 'utf8'));
  assert.deepEqual(paypal.purchase_units[0].amount, { currency_code: 'USD', value: '220.00' });
  assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupons[1].id } })).usedCount, 0);
  for (let retry = 0; retry < 2; retry++)
    await page.request.get(`${base}/api/paypal/retorno?token=${order.paypalOrderId}`, {
      maxRedirects: 0,
    });
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    'APPROVED',
  );
  assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupons[1].id } })).usedCount, 1);
  assert.equal(await db.inventoryMovement.count({ where: { orderId: order.id, type: 'SALE' } }), 1);
  // Existing coupon in CL must still discount CLP, sharing the same record.
  const cl = await customer(coupons[1].code, true);
  await cl.page.goto(`${cl.url}/carrito`);
  assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupons[1].id } })).value, 10000);
  assert.match(await cl.page.locator('body').innerText(), /10\.000/);
  // Expiration after rendering cannot silently charge the undiscounted amount.
  const expired = await customer(coupons[0].code);
  await expired.page.goto(`${base}/checkout`);
  await contact(expired.page, `${tag}-expired@example.invalid`);
  await db.coupon.update({
    where: { id: coupons[0].id },
    data: { endsAt: new Date(Date.now() - 1000) },
  });
  await expired.page.getByRole('button', { name: 'Pagar US$ 210 con PayPal', exact: true }).click();
  await expired.page.getByRole('alert').filter({ hasText: 'vencido' }).first().waitFor();
  assert.equal(await db.order.count({ where: { email: `${tag}-expired@example.invalid` } }), 0);
  await expired.page.getByRole('button', { name: 'Quitar cupón' }).click();
  await total(expired.page, 'Total', 'US$ 230');
  // Email entered after applying a coupon is checked again on the server.
  await db.coupon.update({ where: { id: coupons[1].id }, data: { perUserLimit: 1 } });
  const limited = await customer(coupons[1].code);
  await limited.page.goto(`${base}/checkout`);
  await contact(limited.page, `${tag.toUpperCase()}@EXAMPLE.INVALID`);
  await limited.page.getByRole('button', { name: 'Pagar US$ 220 con PayPal', exact: true }).click();
  await limited.page.getByRole('alert').filter({ hasText: 'máximo de veces' }).first().waitFor();
  assert.equal(await db.order.count({ where: { email: `${tag}@example.invalid` } }), 1);
  // Free shipping still selects a real service, with zero charged shipping.
  const free = await customer(coupons[2].code);
  await free.page.goto(`${base}/checkout`);
  await contact(free.page, `${tag}-free@example.invalid`);
  await total(free.page, 'Envío', 'Gratis');
  await total(free.page, 'Total', 'US$ 200');
  await free.page.getByRole('button', { name: 'Pagar US$ 200 con PayPal', exact: true }).click();
  await free.page.waitForURL('https://www.sandbox.paypal.com/**');
  const freeOrder = await db.order.findFirstOrThrow({
    where: { email: `${tag}-free@example.invalid` },
  });
  assert.equal(freeOrder.shippingTotal, 0);
  assert.equal(freeOrder.chargedCents, 20000);
  assert.equal(freeOrder.shippingRateId, 'envia:dhl:express');
  assert.equal(freeOrder.couponId, coupons[2].id);
  assert.deepEqual(errors, []);
  console.log(
    `PASS: cart, mobile, checkout, CLP regression, stale totals, expiry, guest limits, free shipping, PayPal amount and idempotent use. Artifacts: ${records}`,
  );
} catch (error) {
  for (const [i, page] of browser
    .contexts()
    .flatMap((c) => c.pages())
    .entries()) {
    console.error(
      `Page ${i}: ${page.url()}\n${await page
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
  await db.order.deleteMany({ where: { email: { startsWith: tag } } });
  await db.cart.deleteMany({ where: { id: { in: cartIds } } });
  await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
  if (productId) await db.product.delete({ where: { id: productId } });
  if (rateId) await db.exchangeRate.delete({ where: { id: rateId } });
  await db.$disconnect();
}
