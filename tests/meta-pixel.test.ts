import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { DEFAULT_META_PIXEL_ID, metaCartData, metaPixelBootstrap, resolveMetaPixelId, trackMetaEvent, trackMetaPageView } from '../src/lib/meta-pixel';

function browser(storageBlocked = false) {
  const scripts: { src?: string; async?: boolean }[] = [];
  const storage = new Map<string, string>();
  const mockWindow = {
    location: { pathname: '/', search: '' },
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
      getElementsByTagName: () => [{ parentNode: {
        insertBefore: (script: { src?: string }) => scripts.push(script),
      } }],
    },
    configurable: true,
  });
  return { scripts, storage, window: mockWindow };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
});

function executeBootstrap(pixelId: string, env: ReturnType<typeof browser>) {
  runInNewContext(metaPixelBootstrap(pixelId)!, {
    window: env.window,
    document: globalThis.document,
    URLSearchParams,
    get fbq() { return env.window.fbq; },
  });
}

function queuedEvents(env: ReturnType<typeof browser>) {
  // El snippet oficial guarda objetos arguments; el respaldo usa arrays.
  return Array.from(env.window.fbq?.queue ?? [], (args) => Array.from(args));
}

function eventName(call: unknown[]) {
  return call[0] === 'track' ? call[1] : call[2];
}

test('instala el píxel solicitado incluso con ajustes antiguos vacíos o inválidos', () => {
  assert.equal(DEFAULT_META_PIXEL_ID, '1302438768639889');
  for (const value of [undefined, null, '', ' ', '<script>fbq(...)</script>']) {
    assert.equal(resolveMetaPixelId(value), '1302438768639889');
  }
  assert.equal(resolveMetaPixelId(' 123456789 '), '123456789');
});

test('el HTML solo recibe un snippet cuando hay un ID numérico, sin interpolar código del panel', () => {
  for (const id of ['', ' ', 'abc', "123');alert(1)", '<script>bad()</script>']) {
    assert.equal(metaPixelBootstrap(id), null);
  }
  assert.ok(metaPixelBootstrap(' 200001 ')?.includes('fbq(\'init\',"200001")'));
});

test('inicializa el píxel y PageView antes de ejecutar React o cualquier evento de producto', () => {
  const env = browser();
  executeBootstrap('200002', env);
  assert.equal(env.scripts.length, 1);
  assert.equal(env.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(queuedEvents(env), [
    ['init', '200002'],
    ['track', 'PageView'],
  ]);
});

test('la hidratación reutiliza el píxel del HTML sin duplicar script, init ni PageView', () => {
  const env = browser();
  executeBootstrap('200003', env);
  trackMetaPageView('200003', '/');
  trackMetaPageView('200003', '/');
  trackMetaEvent('200003', 'ViewContent', { content_ids: ['product-1'] });
  const calls = queuedEvents(env);
  assert.equal(env.scripts.length, 1);
  assert.equal(calls.filter((call) => call[0] === 'init').length, 1);
  assert.equal(calls.filter((call) => eventName(call) === 'PageView').length, 1);
  assert.equal(calls.filter((call) => call[2] === 'ViewContent').length, 1);
  trackMetaPageView('200003', '/checkout');
  trackMetaPageView('200003', '/');
  assert.equal(queuedEvents(env).filter((call) => eventName(call) === 'PageView').length, 3);
});

test('no duplica la visita inicial cuando la búsqueda contiene espacios codificados', () => {
  const env = browser();
  Object.assign(env.window.location, { pathname: '/catalogo', search: '?q=traje%20negro' });
  executeBootstrap('200004', env);
  trackMetaPageView('200004', '/catalogo?q=traje+negro');
  assert.equal(queuedEvents(env).filter((call) => eventName(call) === 'PageView').length, 1);
});

test('si el documento inicial no tenía píxel, la navegación puede inicializarlo como respaldo', () => {
  const env = browser();
  assert.equal(trackMetaPageView('200005', '/catalogo'), true);
  assert.equal(env.scripts.length, 1);
  assert.equal(queuedEvents(env).filter((call) => call[0] === 'init').length, 1);
  assert.equal(queuedEvents(env).filter((call) => call[2] === 'PageView').length, 1);
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
