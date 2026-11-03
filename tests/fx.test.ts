import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clpToIntlCents, formatUsdCents, roundUsd, type FxConfig } from '../src/lib/fx';

const fx: FxConfig = { clpPerUsd: 988, marginPct: 18, vatPct: 19, rounding: 'WHOLE_9' };

test('precio internacional: neto sin IVA, tipo de cambio, margen y redondeo comercial', () => {
  // 139.990 / 1,19 = 117.639 → / 988 = 119,07 → × 1,18 = 140,50 → 149
  assert.equal(clpToIntlCents(139990, fx), 14900);
  // 189.900 / 1,19 = 159.580 → / 988 = 161,52 → × 1,18 = 190,59 → 199
  assert.equal(clpToIntlCents(189900, fx), 19900);
});

test('el IVA no se cobra al extranjero', () => {
  const sinIva = clpToIntlCents(119000, { ...fx, vatPct: 19, rounding: 'CENTS_99' });
  const conIva = clpToIntlCents(119000, { ...fx, vatPct: 0, rounding: 'CENTS_99' });
  assert.ok(sinIva < conIva);
});

test('redondeos: siempre hacia arriba', () => {
  assert.equal(roundUsd(140.5, 'WHOLE_9'), 14900);
  assert.equal(roundUsd(149, 'WHOLE_9'), 14900);
  assert.equal(roundUsd(149.01, 'WHOLE_9'), 15900);
  assert.equal(roundUsd(140.5, 'WHOLE_5'), 14500);
  assert.equal(roundUsd(146, 'WHOLE_5'), 15500);
  assert.equal(roundUsd(140.5, 'WHOLE'), 14100);
  assert.equal(roundUsd(140, 'WHOLE'), 14000);
  assert.equal(roundUsd(140.5, 'CENTS_99'), 14099);
  assert.equal(roundUsd(140.995, 'CENTS_99'), 14199);
  assert.equal(roundUsd(140, 'CENTS_99'), 14099);
  // Ruido de punto flotante no salta de escalón.
  assert.equal(roundUsd(139.0000000001, 'WHOLE_9'), 13900);
});

test('sin tipo de cambio no hay precio', () => {
  assert.throws(() => clpToIntlCents(139990, { ...fx, clpPerUsd: 0 }));
});

test('formato', () => {
  assert.equal(formatUsdCents(14900), 'US$ 149');
  assert.equal(formatUsdCents(13899), 'US$ 138.99');
  assert.equal(formatUsdCents(129900), 'US$ 1,299');
});
