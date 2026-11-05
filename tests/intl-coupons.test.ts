import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { prisma } from '../src/lib/db';
import { evaluateCoupon } from '../src/lib/pricing';
import { evaluateIntlCart } from '../src/lib/intl-cart';
import { intlTotal } from '../src/lib/intl-checkout';
import type { CartSummary } from '../src/lib/cart';

if (!process.env.DATABASE_URL?.includes('/taupoc_test')) {
  throw new Error('Use the dedicated taupoc_test database.');
}

test('shared coupons in CLP and USD against PostgreSQL', async (t) => {
  const tag = `coupon-${randomUUID()}`;
  const product = await prisma.product.create({
    data: { slug: tag, name: tag, modelCode: tag, basePrice: 139990 },
  });
  const code = tag.toUpperCase();
  const coupon = await prisma.coupon.create({ data: { code, type: 'PERCENT', value: 10 } });
  const fx = { clpPerUsd: 988, marginPct: 18, vatPct: 19, rounding: 'WHOLE_9' as const };
  const usd = { currency: 'USD' as const, clpPerUsd: fx.clpPerUsd };
  const lines = [{ productId: product.id, unitPrice: 14900, quantity: 2 }];
  const reset = (data: Parameters<typeof prisma.coupon.update>[0]['data']) =>
    prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        type: 'PERCENT',
        value: 10,
        active: true,
        minSubtotal: null,
        maxUses: null,
        usedCount: 0,
        perUserLimit: null,
        startsAt: null,
        endsAt: null,
        products: { deleteMany: {} },
        ...data,
      },
    });
  try {
    await t.test(
      'percent uses the actual rounded USD product price, CLP stays unchanged',
      async () => {
        assert.equal(
          (await evaluateCoupon(` ${code.toLowerCase()} `, lines, null, usd)).discount,
          2980,
        );
        assert.equal(
          (await evaluateCoupon(code, [{ ...lines[0], unitPrice: 139990 }])).discount,
          27998,
        );
      },
    );
    await t.test('fixed face value converts at FX only and caps at eligible subtotal', async () => {
      await reset({ type: 'FIXED', value: 10000 });
      assert.equal((await evaluateCoupon(code, lines, null, usd)).discount, 1012);
      assert.equal((await evaluateCoupon(code, lines)).discount, 10000);
      await reset({ type: 'FIXED', value: 1000000 });
      assert.equal((await evaluateCoupon(code, lines, null, usd)).discount, 29800);
    });
    await t.test('minimum spend converts upward to cents', async () => {
      await reset({ minSubtotal: 100000 });
      assert.equal(
        (await evaluateCoupon(code, [{ ...lines[0], quantity: 1, unitPrice: 10121 }], null, usd))
          .ok,
        false,
      );
      assert.equal(
        (await evaluateCoupon(code, [{ ...lines[0], quantity: 1, unitPrice: 10122 }], null, usd))
          .ok,
        true,
      );
    });
    await t.test('product restrictions discount only matching products', async () => {
      await reset({ products: { create: { productId: product.id } } });
      const other = { productId: 'not-eligible', unitPrice: 50000, quantity: 1 };
      assert.equal((await evaluateCoupon(code, [...lines, other], null, usd)).discount, 2980);
      assert.equal((await evaluateCoupon(code, [other], null, usd)).ok, false);
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { type: 'FIXED', value: 1000000 },
      });
      assert.equal((await evaluateCoupon(code, [...lines, other], null, usd)).discount, 29800);
    });
    await t.test('inactive, future, expired and exhausted coupons reject', async () => {
      for (const data of [
        { active: false },
        { startsAt: new Date(Date.now() + 60000) },
        { endsAt: new Date(Date.now() - 60000) },
        { maxUses: 1, usedCount: 1 },
      ]) {
        await reset(data);
        assert.equal((await evaluateCoupon(code, lines, null, usd)).ok, false);
      }
      assert.equal((await evaluateCoupon(`${code}-missing`, lines, null, usd)).ok, false);
    });
    await t.test(
      'approved uses in CL count toward the same guest email limit in INTL',
      async () => {
        await reset({ perUserLimit: 1 });
        const email = `${tag}@example.invalid`;
        await prisma.order.create({
          data: {
            number: tag,
            email,
            couponId: coupon.id,
            paymentStatus: 'APPROVED',
            storefront: 'CL',
            subtotal: 10000,
            total: 9000,
          },
        });
        assert.equal(
          (await evaluateCoupon(code, lines, ` ${email.toUpperCase()} `, usd)).ok,
          false,
        );
        assert.equal((await evaluateCoupon(code, lines, 'other@example.invalid', usd)).ok, true);
      },
    );
    await t.test('free shipping retains a delivery quote but charges zero shipping', async () => {
      await reset({ type: 'FREE_SHIPPING', value: 0 });
      const result = await evaluateCoupon(code, lines, null, usd);
      assert.equal(result.freeShipping, true);
      assert.deepEqual(
        intlTotal(
          {
            subtotalCents: 29800,
            discountCents: result.discount,
            freeShipping: result.freeShipping,
          },
          3040,
        ),
        { shippingCents: 0, totalCents: 29800 },
      );
    });
    await t.test(
      'INTL re-evaluates the stored code even if CLP evaluation rejected it',
      async () => {
        await reset({ minSubtotal: 145000 });
        assert.equal(
          (await evaluateCoupon(code, [{ ...lines[0], quantity: 1, unitPrice: 139990 }])).ok,
          false,
        );
        const cart = {
          requestedCouponCode: code,
          couponCode: null,
          discount: 0,
          lines: [
            {
              productId: product.id,
              itemId: tag,
              unitPrice: 139990,
              quantity: 1,
              productName: tag,
              colorName: 'Negro',
              size: '24',
            },
          ],
        } as CartSummary;
        const { pricing } = await evaluateIntlCart(cart, fx);
        assert.equal(pricing.subtotalCents, 14900);
        assert.equal(pricing.discountCents, 1490);
        assert.equal(pricing.couponCode, code);
        assert.equal(pricing.couponError, null);
        assert.equal(intlTotal(pricing, 3040).totalCents, 16450);
        await reset({ active: false });
        const invalid = await evaluateIntlCart(cart, fx);
        assert.equal(invalid.pricing.couponCode, null);
        assert.equal(invalid.pricing.requestedCouponCode, code);
        assert.ok(invalid.pricing.couponError);
      },
    );
    await t.test('invalid FX cannot apply a coupon', async () => {
      await reset({});
      for (const rate of [0, -1, NaN, Infinity])
        assert.equal(
          (await evaluateCoupon(code, lines, null, { currency: 'USD', clpPerUsd: rate })).ok,
          false,
        );
    });
  } finally {
    await prisma.order.deleteMany({ where: { number: tag } });
    await prisma.coupon.delete({ where: { id: coupon.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  }
});
