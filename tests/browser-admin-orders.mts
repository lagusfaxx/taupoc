import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
if (
  !process.env.DATABASE_URL ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Use a local development database.');
if (process.env.MP_ACCESS_TOKEN || process.env.RESEND_API_KEY || process.env.SMTP_HOST)
  throw new Error('Run browser smoke tests without external payment or mail credentials.');
const db = new PrismaClient();
const tag = `smoke-${randomUUID()}`;
const product = await db.product.create({
  data: {
    slug: tag,
    name: 'Prueba demanda',
    modelCode: tag,
    basePrice: 12000,
    status: 'ACTIVE',
    colors: { create: { name: 'Azul', slug: 'azul' } },
  },
  include: { colors: true },
});
const v = await Promise.all(
  [
    { size: '22', stock: 4, active: true },
    { size: '24', stock: 0, active: true },
    { size: '26', stock: 3, active: false },
  ].map((p, i) =>
    db.variant.create({
      data: { ...p, productId: product.id, colorId: product.colors[0].id, sku: `${tag}-${i}` },
    }),
  ),
);
const admin = await db.user.create({
  data: { email: `${tag}@example.invalid`, name: 'Prueba', role: 'ADMIN' },
});
const zone = await db.shippingZone.create({
  data: { name: tag, regions: ['RM'], rates: { create: { label: tag, isPickup: true, price: 0 } } },
  include: { rates: true },
});
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
try {
  const customer = await browser.newContext();
  const page = await customer.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  assert.equal((await customer.request.get(`${base}/api/admin/export/pedidos`)).status(), 401);
  await page.goto(`${base}/admin/pedidos/nuevo`);
  await page.waitForURL(/\/admin\/ingresar/);
  const staff = await browser.newContext();
  const token = await new SignJWT({ email: admin.email, name: admin.name, role: admin.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await staff.addCookies([
    { name: 'taupoc_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  const panel = await staff.newPage();
  await panel.goto(`${base}/admin/pedidos/nuevo`);
  await panel.getByPlaceholder('Buscar productos').fill(v[1].sku);
  await panel.getByRole('button', { name: 'Agregar', exact: true }).click();
  await panel.getByLabel('Nombre', { exact: true }).fill('Cliente');
  await panel.getByLabel('Apellido', { exact: true }).fill('Prueba');
  await panel.getByLabel('Correo', { exact: true }).fill(`${tag}@example.invalid`);
  await panel.getByLabel('Teléfono', { exact: true }).fill('912345678');
  await panel.getByLabel('Estado inicial').selectOption('PAID');
  await panel.getByRole('button', { name: 'Crear pedido', exact: true }).click();
  await panel.waitForURL(/\/admin\/pedidos\/(?!nuevo)[^/]+$/);
  const order = await db.order.findFirstOrThrow({
    where: { email: `${tag}@example.invalid`, creationKey: { not: null } },
    include: { items: true },
  });
  assert.equal(order.total, 12000);
  assert.equal(order.items[0].sku, v[1].sku);
  assert.equal(order.paymentStatus, 'APPROVED');
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: v[1].id } })).stock, -1);
  await panel.locator('select[name="status"]').selectOption('PROCESSING');
  const saved = panel.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/admin/pedidos/${order.id}`);
  await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
  assert.equal((await saved).ok(), true);
  await panel.reload();
  assert.equal(await panel.locator('select[name="status"]').inputValue(), 'PROCESSING');
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'PROCESSING');
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: v[1].id } })).stock, -1);
  await panel.goto(`${base}/admin/tallas`);
  await panel.getByRole('heading', { name: 'Demanda de tallas', exact: true }).waitFor();
  const csv = await staff.request.get(`${base}/api/admin/export/pedidos?periodo=30d`);
  assert.equal(csv.status(), 200);
  assert.ok((await csv.text()).includes(v[1].sku));
  await panel.screenshot({ path: '/tmp/taupoc-report.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: access control, paid admin order without stock, status update, existing demand report and CSV',
  );
} finally {
  await browser.close();
  const orders = await db.order.findMany({
    where: { email: `${tag}@example.invalid` },
    select: { id: true },
  });


  await db.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await db.shippingZone.delete({ where: { id: zone.id } });
  await db.product.delete({ where: { id: product.id } });
  await db.user.delete({ where: { id: admin.id } });
  await db.$disconnect();
}
