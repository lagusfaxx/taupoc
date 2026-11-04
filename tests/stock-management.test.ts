import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { adjustStock } from '../src/lib/inventory';
import { applyStockAdjustment, StockAdjustmentError } from '../src/lib/stock-management';
import {
  stockAdjustmentSchema,
  type StockAdjustmentInput,
} from '../src/lib/stock-adjustment-input';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
if (
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  !database.pathname.startsWith('/taupoc_test')
) {
  throw new Error('Use a dedicated local taupoc_test database.');
}

const actor = 'stock-test@example.invalid';

test('stock changes preserve inventory, reservations and history', async (t) => {
  const tag = `stock-${randomUUID()}`;
  const product = await prisma.product.create({
    data: {
      name: 'Prueba de inventario',
      slug: tag,
      modelCode: tag,
      basePrice: 10000,
      colors: {
        create: [
          { name: 'Azul', slug: 'azul' },
          { name: 'Rojo', slug: 'rojo', active: false },
        ],
      },
    },
    include: { colors: true },
  });
  let sequence = 0;
  async function variant(stock: number, reserved = 0) {
    return prisma.variant.create({
      data: {
        productId: product.id,
        colorId: product.colors[sequence % 2].id,
        size: String(++sequence),
        sku: `${tag}-${sequence}`,
        stock,
        reserved,
        active: false,
      },
    });
  }
  function input(
    items: { id: string; stock: number; reserved: number; quantity: number }[],
    mode: StockAdjustmentInput['mode'] = 'add',
  ): StockAdjustmentInput {
    return {
      productId: product.id,
      operationId: randomUUID(),
      mode,
      note: 'Prueba',
      items: items.map((v) => ({
        variantId: v.id,
        quantity: v.quantity,
        expectedStock: v.stock,
        expectedReserved: v.reserved,
      })),
    };
  }
  const get = (id: string) => prisma.variant.findUniqueOrThrow({ where: { id } });
  try {
    await t.test(
      'adds several sizes and colors without touching their identities, visibility or old history',
      async () => {
        const a = await variant(7, 2);
        const b = await variant(0);
        const history = await prisma.inventoryMovement.create({
          data: {
            variantId: a.id,
            type: 'ADJUST',
            delta: 7,
            resulting: 7,
            reason: 'Registro anterior',
          },
        });
        await applyStockAdjustment(
          input([
            { ...a, quantity: 3 },
            { ...b, quantity: 8 },
          ]),
          actor,
        );
        const after = await get(a.id);
        assert.equal(after.stock, 10);
        assert.equal(after.reserved, 2);
        assert.equal(after.active, false);
        assert.equal(after.sku, a.sku);
        assert.equal((await get(b.id)).stock, 8);
        assert.deepEqual(
          await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: history.id } }),
          history,
        );
        const added = await prisma.inventoryMovement.findFirstOrThrow({
          where: { variantId: a.id, type: 'RESTOCK' },
        });
        assert.equal(added.actorEmail, actor);
        assert.equal(added.delta, 3);
        assert.equal(added.resulting, 10);
      },
    );
    await t.test('duplicate concurrent submissions and retries record the entry once', async () => {
      const v = await variant(5);
      const request = input([{ ...v, quantity: 4 }]);
      await Promise.all([
        applyStockAdjustment(request, actor),
        applyStockAdjustment(request, actor),
      ]);
      await applyStockAdjustment(request, actor);
      assert.equal((await get(v.id)).stock, 9);
      assert.equal(await prisma.inventoryMovement.count({ where: { variantId: v.id } }), 1);
      await assert.rejects(
        applyStockAdjustment({ ...request, items: [{ ...request.items[0], quantity: 5 }] }, actor),
        StockAdjustmentError,
      );
    });
    await t.test('concurrent edits cannot overwrite each other', async () => {
      const v = await variant(5);
      const results = await Promise.allSettled([
        applyStockAdjustment(input([{ ...v, quantity: 2 }]), actor),
        applyStockAdjustment(input([{ ...v, quantity: 2 }]), actor),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal((await get(v.id)).stock, 7);
      assert.equal(await prisma.inventoryMovement.count({ where: { variantId: v.id } }), 1);
    });
    await t.test(
      'a sale or reservation made after opening the form is never overwritten',
      async () => {
        const v = await variant(6);
        await prisma.$transaction((tx) =>
          adjustStock(tx, { variantId: v.id, delta: -1, type: 'SALE' }),
        );
        await assert.rejects(
          applyStockAdjustment(input([{ ...v, quantity: 8 }], 'count'), actor),
          /cambió/,
        );
        assert.equal((await get(v.id)).stock, 5);
        const before = await get(v.id);
        await prisma.variant.update({ where: { id: v.id }, data: { reserved: 2 } });
        await assert.rejects(
          applyStockAdjustment(input([{ ...before, quantity: 1 }], 'remove'), actor),
          /cambió/,
        );
        assert.equal((await get(v.id)).reserved, 2);
      },
    );
    await t.test('removing stock and correcting a count preserve reserved quantities', async () => {
      const v = await variant(8, 3);
      await applyStockAdjustment(input([{ ...v, quantity: 5 }], 'remove'), actor);
      const current = await get(v.id);
      assert.equal(current.stock, 3);
      assert.equal(current.reserved, 3);
      await assert.rejects(
        applyStockAdjustment(input([{ ...current, quantity: 1 }], 'remove'), actor),
        /reservadas/,
      );
      await assert.rejects(
        applyStockAdjustment(input([{ ...current, quantity: 0 }], 'count'), actor),
        /reservadas/,
      );
      await applyStockAdjustment(input([{ ...current, quantity: 9 }], 'count'), actor);
      assert.equal((await get(v.id)).stock, 9);
      assert.equal((await get(v.id)).reserved, 3);
    });
    await t.test('one invalid line rolls back every stock change and movement', async () => {
      const a = await variant(5);
      const b = await variant(1, 1);
      const before = await prisma.variant.findMany({
        where: { productId: product.id },
        orderBy: { id: 'asc' },
      });
      const movements = await prisma.inventoryMovement.findMany({
        where: { variant: { productId: product.id } },
        orderBy: { id: 'asc' },
      });
      await assert.rejects(
        applyStockAdjustment(
          input(
            [
              { ...a, quantity: 2 },
              { ...b, quantity: 1 },
            ],
            'remove',
          ),
          actor,
        ),
        StockAdjustmentError,
      );
      assert.deepEqual(
        await prisma.variant.findMany({ where: { productId: product.id }, orderBy: { id: 'asc' } }),
        before,
      );
      assert.deepEqual(
        await prisma.inventoryMovement.findMany({
          where: { variant: { productId: product.id } },
          orderBy: { id: 'asc' },
        }),
        movements,
      );
    });
    await t.test('partial replenishment preserves existing negative balances', async () => {
      const v = await variant(-6);
      await applyStockAdjustment(input([{ ...v, quantity: 2 }]), actor);
      assert.equal((await get(v.id)).stock, -4);
      const current = await get(v.id);
      await applyStockAdjustment(input([{ ...current, quantity: 7 }]), actor);
      assert.equal((await get(v.id)).stock, 3);
    });
    await t.test(
      'invalid quantities, duplicates, missing variants and mismatched products make no changes',
      async () => {
        const v = await variant(10);
        const base = input([{ ...v, quantity: 1 }]);
        for (const quantity of [-1, 1.5, NaN, Infinity, 1_000_001]) {
          assert.equal(
            stockAdjustmentSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity }] })
              .success,
            false,
          );
        }
        await assert.rejects(
          applyStockAdjustment({ ...base, items: [base.items[0], base.items[0]] }, actor),
          StockAdjustmentError,
        );
        await assert.rejects(
          applyStockAdjustment({ ...base, productId: 'not-this-product' }, actor),
          StockAdjustmentError,
        );
        await assert.rejects(
          applyStockAdjustment(
            { ...base, items: [{ ...base.items[0], variantId: 'missing' }] },
            actor,
          ),
          StockAdjustmentError,
        );
        assert.equal((await get(v.id)).stock, 10);
        assert.equal(await prisma.inventoryMovement.count({ where: { variantId: v.id } }), 0);
      },
    );
  } finally {
    // Only this test's fixtures; no reset or deletion of pre-existing inventory.
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  }
});
