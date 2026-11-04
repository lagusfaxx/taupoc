import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { chromium, type Page } from 'playwright';
import { SignJWT } from 'jose';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
if (
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  !database.pathname.startsWith('/taupoc_test')
)
  throw new Error('Use a dedicated local taupoc_test database.');
if (process.env.MP_ACCESS_TOKEN || process.env.RESEND_API_KEY || process.env.SMTP_HOST)
  throw new Error('Run without payment or mail credentials.');
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();
const tag = `browser-stock-${randomUUID()}`;
const product = await db.product.create({
  data: {
    name: 'Traje de competición TS703',
    slug: tag,
    modelCode: tag,
    basePrice: 65000,
    status: 'ACTIVE',
    colors: {
      create: [
        { name: 'Azul', slug: 'azul', hex: '#3157A8', sortOrder: 0 },
        { name: 'Negro', slug: 'negro', hex: '#191D24', sortOrder: 1 },
      ],
    },
    images: { create: { url: '/icon.svg', alt: 'Imagen de prueba' } },
  },
  include: { colors: { orderBy: { sortOrder: 'asc' } }, images: true },
});
const variants = [];
for (const color of product.colors) {
  for (const [index, size] of ['22', '24', '26', '28', '30', '32'].entries()) {
    variants.push(
      await db.variant.create({
        data: {
          productId: product.id,
          colorId: color.id,
          sku: `${tag}-${color.slug}-${size}`,
          size,
          sortOrder: index,
          stock: size === '24' ? 0 : size === '26' ? -2 : size === '28' ? 1 : 5,
          reserved: size === '22' ? 1 : 0,
          active: size !== '32',
        },
      }),
    );
  }
}
const oldMovement = await db.inventoryMovement.create({
  data: {
    variantId: variants[0].id,
    type: 'RESTOCK',
    delta: 5,
    resulting: 5,
    reason: 'Ingreso anterior conservado',
    actorEmail: 'bodega@example.invalid',
  },
});
const interest = await db.sizeInterest.create({
  data: { variantId: variants[0].id, visitorKey: tag },
});
const staffUser = await db.user.create({
  data: { email: `${tag}@example.invalid`, name: 'Equipo de bodega', role: 'STAFF' },
});
const customerUser = await db.user.create({
  data: { email: `${tag}-customer@example.invalid`, name: 'Cliente', role: 'CUSTOMER' },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const errors: string[] = [];
let currentPage: Page | undefined;
const inventoryURL = `${base}/admin/inventario?producto=${product.id}`;
async function contextFor(user: typeof staffUser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await context.addCookies([
    { name: 'taupoc_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  return context;
}
try {
  const anon = await browser.newContext();
  assert.equal((await anon.request.get(`${base}/api/admin/export/movimientos`)).status(), 401);
  const unauthorized = await anon.newPage();
  await unauthorized.goto(inventoryURL);
  await unauthorized.waitForURL(/\/admin\/ingresar/);
  const customer = await contextFor(customerUser);
  assert.equal((await customer.request.get(`${base}/api/admin/export/movimientos`)).status(), 401);
  const customerPage = await customer.newPage();
  await customerPage.goto(`${base}/admin/inventario/historial`);
  await customerPage.waitForURL(/\/admin\/ingresar/);

  const staff = await contextFor(staffUser);
  const page = await staff.newPage();
  currentPage = page;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(inventoryURL);
  await page.getByRole('heading', { name: 'Inventario', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/taupoc-stock-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Agregar stock', exact: true }).click();
  await page.getByLabel('Agregar talla 22', { exact: true }).fill('2');
  await page.getByLabel('Agregar talla 24', { exact: true }).fill('4');
  await page.getByLabel(`Color de ${product.name}`).selectOption(product.colors[1].id);
  await page.getByLabel('Agregar talla 22', { exact: true }).fill('3');
  await page.getByPlaceholder('Ej. Reposición de noviembre').fill('Reposición de prueba');
  assert.ok(
    await page
      .getByText('Revisa el cambio · 9 unidades · 3 tallas y colores', { exact: true })
      .isVisible(),
  );
  await page.screenshot({ path: '/tmp/taupoc-stock-entry.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar entrada', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '9 unidades actualizadas' }).waitFor();
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[0].id } })).stock, 7);
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[1].id } })).stock, 4);
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[6].id } })).stock, 8);

  await page.getByRole('button', { name: 'Quitar stock', exact: true }).click();
  await page.getByLabel('Quitar talla 22', { exact: true }).fill('7');
  assert.equal(
    await page.getByRole('button', { name: 'Guardar salida', exact: true }).isDisabled(),
    true,
  );
  await page.getByLabel('Quitar talla 22', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Guardar salida', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '1 unidad actualizada' }).waitFor();
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[0].id } })).stock, 6);
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[0].id } })).reserved, 1);

  await page.getByRole('button', { name: 'Corregir conteo', exact: true }).click();
  await page.getByLabel('Conteo talla 24', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Guardar conteo', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '4 unidades actualizadas' }).waitFor();
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[1].id } })).stock, 0);

  await page.getByRole('button', { name: 'Mostrar u ocultar tallas', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar talla 22', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar talla 22', exact: true }).waitFor();
  assert.equal(
    (await db.variant.findUniqueOrThrow({ where: { id: variants[0].id } })).active,
    false,
  );
  assert.deepEqual(
    await db.inventoryMovement.findUniqueOrThrow({ where: { id: oldMovement.id } }),
    oldMovement,
  );
  await page.getByRole('button', { name: 'Mostrar talla 22', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar talla 22', exact: true }).waitFor();
  assert.equal(
    (await db.variant.findUniqueOrThrow({ where: { id: variants[0].id } })).active,
    true,
  );

  await page.getByRole('link', { name: 'Ver historial de movimientos', exact: true }).click();
  await page.getByRole('heading', { name: 'Historial de stock', exact: true }).waitFor();
  await page.getByText('Ingreso anterior conservado', { exact: true }).waitFor();
  const csv = await staff.request.get(
    `${base}/api/admin/export/movimientos?producto=${product.id}&tipo=RESTOCK`,
  );
  assert.equal(csv.status(), 200);
  const csvText = await csv.text();
  assert.ok(csvText.includes('Ingreso anterior conservado'));
  assert.ok(csvText.includes('Reposición de prueba'));
  assert.ok(!csvText.includes('Quitar stock'));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(inventoryURL);
  await page.getByRole('button', { name: 'Agregar stock', exact: true }).click();
  await page.getByLabel('Agregar talla 28', { exact: true }).fill('2');
  await page.screenshot({ path: '/tmp/taupoc-stock-mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Mobile inventory must not scroll horizontally',
  );
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal((await db.variant.findUniqueOrThrow({ where: { id: variants[3].id } })).stock, 1);

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${base}/admin/productos/${product.id}`);
  await page.getByRole('tab', { name: 'Stock', exact: true }).click();
  await page.getByText('Agregar una talla', { exact: true }).click();
  await page.getByPlaceholder('Ej. 38 o XL').fill('38');
  await page.getByRole('button', { name: 'Agregar talla', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Talla 38 agregada a 2 colores' }).waitFor();
  assert.equal(
    await db.variant.count({ where: { productId: product.id, size: '38', stock: 0 } }),
    2,
  );
  await page.getByRole('tab', { name: 'Colores (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar Azul', exact: true }).waitFor();
  assert.equal(
    (await db.productColor.findUniqueOrThrow({ where: { id: product.colors[0].id } })).active,
    false,
  );
  assert.equal(await db.variant.count({ where: { productId: product.id } }), 14);
  assert.deepEqual(
    await db.productImage.findUniqueOrThrow({ where: { id: product.images[0].id } }),
    product.images[0],
  );
  assert.deepEqual(
    await db.sizeInterest.findUniqueOrThrow({ where: { id: interest.id } }),
    interest,
  );

  await page.getByRole('button', { name: 'Mostrar Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar Azul', exact: true }).waitFor();
  assert.equal((await db.productColor.findUniqueOrThrow({ where: { id: product.colors[0].id } })).active, true);

  const beforeArchive = await db.inventoryMovement.findMany({
    where: { variant: { productId: product.id } },
    orderBy: { id: 'asc' },
  });
  await page.goto(`${base}/admin/productos?q=${encodeURIComponent(tag)}`);
  await page
    .getByRole('button', { name: `Más acciones para ${product.name}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Archivar', exact: true }).click();
  await page.waitForURL(/archivado=1/);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).status,
    'ARCHIVED',
  );
  assert.equal(await db.variant.count({ where: { productId: product.id } }), 14);
  assert.deepEqual(
    await db.inventoryMovement.findMany({
      where: { variant: { productId: product.id } },
      orderBy: { id: 'asc' },
    }),
    beforeArchive,
  );
  assert.deepEqual(
    await db.productImage.findUniqueOrThrow({ where: { id: product.images[0].id } }),
    product.images[0],
  );
  await page.goto(`${inventoryURL}&filtro=inactivo`);
  await page.getByRole('heading', { name: product.name, exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: permissions, multi-color entry, removal, count, reservations, history/CSV, mobile, add/hide sizes, hide color and archive without losing data.',
  );
} catch (error) {
  if (currentPage) {
    console.error('Visible alerts:', await currentPage.getByRole('alert').allTextContents());
    console.error('Visible status:', await currentPage.getByRole('status').allTextContents());
    await currentPage.screenshot({ path: '/tmp/taupoc-stock-failure.png', fullPage: true });
  }
  throw error;
} finally {
  await browser.close();
  await db.product.delete({ where: { id: product.id } });
  await db.user.deleteMany({ where: { id: { in: [staffUser.id, customerUser.id] } } });
  await db.$disconnect();
}
