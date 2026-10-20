import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { metaCartData, trackMetaEvent } from '../src/lib/meta-pixel';

function browser(storageBlocked = false) {
  const scripts: { src?: string; async?: boolean }[] = [];
  const storage = new Map<string, string>();
  const mockWindow = {
    localStorage: {
      getItem(key: string) {
        if (storageBlocked) throw new Error('Storage blocked');
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (storageBlocked) throw new Error('Storage blocked');
        storage.set(key, value);
      },
    },
  } as unknown as Window;
  Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true });
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: () => ({}),
      head: { appendChild: (script: { src?: string }) => scripts.push(script) },
    },
    configurable: true,
  });
  return { scripts, storage, window: mockWindow };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
});

test('sin navegador o con ID vacío/inválido no carga ni envía eventos', () => {
  assert.equal(trackMetaEvent('123456', 'PageView'), false);
  const env = browser();
  for (const pixelId of ['', 'abc', "123');alert(1)"]) {
    assert.equal(trackMetaEvent(pixelId, 'PageView'), false);
  }
  assert.equal(env.scripts.length, 0);
  assert.equal(env.window.fbq, undefined);
});

test('conserva eventos tempranos y carga el script e inicializa el píxel una sola vez', () => {
  const env = browser();
  assert.equal(trackMetaEvent('100001', 'PageView'), true);
  trackMetaEvent('100001', 'ViewContent', { content_ids: ['product-1'], currency: 'CLP', value: 139900 });
  trackMetaEvent('100001', 'AddToCart', { value: 139900, currency: 'CLP' });
  assert.equal(env.scripts.length, 1);
  assert.equal(env.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.equal(env.scripts[0].async, true);
  assert.deepEqual(env.window.fbq?.queue, [
    ['init', '100001'],
    ['trackSingle', '100001', 'PageView', {}],
    ['trackSingle', '100001', 'ViewContent', { content_ids: ['product-1'], currency: 'CLP', value: 139900 }],
    ['trackSingle', '100001', 'AddToCart', { value: 139900, currency: 'CLP' }],
  ]);
});

test('deduplica la compra y mantiene un eventID estable sin bloquear pedidos distintos', () => {
  const env = browser();
  const data = { value: 149900, currency: 'CLP' };
  trackMetaEvent('100002', 'Purchase', data, 'purchase:order-1');
  trackMetaEvent('100002', 'Purchase', data, 'purchase:order-1');
  trackMetaEvent('100002', 'Purchase', data, 'purchase:order-2');
  const events = env.window.fbq?.queue.filter((call) => call[2] === 'Purchase');
  assert.equal(events?.length, 2);
  assert.deepEqual(events?.[0], ['trackSingle', '100002', 'Purchase', data, { eventID: 'purchase:order-1' }]);
  assert.equal(env.storage.size, 2);
});

test('respeta la compra ya registrada en almacenamiento de una carga anterior', () => {
  const env = browser();
  // Simula una recarga donde el registro persistente ya existe.
  env.window.localStorage.getItem = () => '1';
  trackMetaEvent('100003', 'Purchase', { value: 149900, currency: 'CLP' }, 'purchase:old-order');
  assert.equal(env.scripts.length, 0);
});

test('un almacenamiento bloqueado permite medir y deduplicar durante la visita', () => {
  const env = browser(true);
  trackMetaEvent('100004', 'Purchase', { value: 900 }, 'purchase:order-3');
  trackMetaEvent('100004', 'Purchase', { value: 900 }, 'purchase:order-3');
  assert.equal(env.window.fbq?.queue.filter((call) => call[2] === 'Purchase').length, 1);
});

test('errores del píxel no interrumpen las acciones de la tienda', () => {
  const env = browser();
  env.window.fbq = (() => { throw new Error('Pixel unavailable'); }) as unknown as NonNullable<Window['fbq']>;
  assert.equal(trackMetaEvent('100005', 'AddToCart', { value: 900 }), false);
});

test('checkout conserva unidades, productos y montos en pesos, con descuento', () => {
  assert.deepEqual(metaCartData({
    lines: [
      { productId: 'product-1', quantity: 2, unitPrice: 139900 },
      { productId: 'product-1', quantity: 1, unitPrice: 139900 },
      { productId: 'product-2', quantity: 1, unitPrice: 9900 },
    ],
    subtotal: 429600,
    discount: 10000,
  }), {
    content_type: 'product',
    content_ids: ['product-1', 'product-2'],
    contents: [
      { id: 'product-1', quantity: 2, item_price: 139900 },
      { id: 'product-1', quantity: 1, item_price: 139900 },
      { id: 'product-2', quantity: 1, item_price: 9900 },
    ],
    num_items: 4,
    value: 419600,
    currency: 'CLP',
  });
});
