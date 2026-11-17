import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPercent, isScarce, variantPrice } from '../src/lib/variant-price';

const now = new Date('2026-11-17T12:00:00Z');

test('sin oferta cobra el precio normal', () => {
  assert.deepEqual(variantPrice({ priceOverride: null }, 89990, now), {
    price: 89990, regular: 89990, percent: null, endsAt: null,
  });
});

test('la oferta se aplica sobre el precio propio de la talla y redondea a la decena', () => {
  const p = variantPrice({ priceOverride: 99990, salePercent: 15 }, 89990, now);
  assert.equal(p.regular, 99990);
  assert.equal(p.price, 84990);
  assert.equal(p.percent, 15);
  assert.equal(applyPercent(10005, 0), 10010);
});

test('una oferta vencida vuelve sola al precio normal', () => {
  const vencida = variantPrice({ priceOverride: null, salePercent: 20, saleEndsAt: new Date('2026-11-17T11:59:59Z') }, 50000, now);
  assert.equal(vencida.price, 50000);
  assert.equal(vencida.percent, null);
  const vigente = variantPrice({ priceOverride: null, salePercent: 20, saleEndsAt: '2026-11-20T00:00:00Z' }, 50000, now);
  assert.equal(vigente.price, 40000);
  assert.equal(vigente.endsAt, '2026-11-20T00:00:00.000Z');
});

test('porcentajes fuera de rango no descuentan', () => {
  assert.equal(variantPrice({ priceOverride: null, salePercent: 0 }, 50000, now).price, 50000);
  assert.equal(variantPrice({ priceOverride: null, salePercent: 95 }, 50000, now).price, 50000);
});

test('quedan pocas: umbral por defecto, propio y desactivado', () => {
  assert.equal(isScarce(3, {}), true);
  assert.equal(isScarce(4, {}), false);
  assert.equal(isScarce(0, {}), false);
  assert.equal(isScarce(5, { scarcityFrom: 5 }), true);
  assert.equal(isScarce(1, { scarcityFrom: 0 }), false);
});
