import assert from 'node:assert/strict';
import { test } from 'node:test';
import { intlMetadata } from '../src/lib/intl-seo';

test('taupoc.lat: ningún título ni descripción dice Chile', () => {
  const meta = intlMetadata({
    title: 'Trajes de baño de competencia en Chile',
    description: 'Despacho a todo Chile, tienda chilena.',
    path: '/catalogo',
  });
  const text = JSON.stringify(meta);
  assert.doesNotMatch(text, /chile|chilen/i);
});

test('taupoc.lat: canónica propia y hreflang hacia taupoc.cl', () => {
  const meta = intlMetadata({ title: 'R-SKIN Jammer', description: 'Jammer', path: '/producto/x', clPath: '/producto/x' });
  assert.equal(meta.alternates?.canonical, 'https://taupoc.lat/producto/x');
  assert.deepEqual(meta.alternates?.languages, {
    'es-CL': 'http://localhost:3000/producto/x',
    'es-419': 'https://taupoc.lat/producto/x',
    'x-default': 'https://taupoc.lat/producto/x',
  });
});

test('taupoc.lat: sin INTL_INDEXABLE todo va con noindex', () => {
  const meta = intlMetadata({ title: 'Catálogo', description: 'Catálogo', path: '/catalogo' });
  assert.deepEqual(meta.robots, { index: false, follow: false });
});
