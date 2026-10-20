export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Search';

export type MetaEventData = Record<string, unknown>;

interface PixelFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: PixelFunction;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
  }
}

const initialized = new Set<string>();
const purchases = new Set<string>();

export function isMetaPixelId(value: string): boolean {
  return /^\d+$/.test(value);
}

/** La cola oficial conserva eventos aunque fbevents.js todavía esté cargando. */
function initialize(pixelId: string): PixelFunction {
  if (!window.fbq) {
    const fbq: PixelFunction = Object.assign(
      (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      },
      { queue: [] as unknown[][], loaded: true, version: '2.0' },
    ) as PixelFunction;
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq ??= fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  if (!initialized.has(pixelId)) {
    window.fbq('init', pixelId);
    initialized.add(pixelId);
  }
  return window.fbq;
}

/** Devuelve true al entregar el evento a la cola, no confirma recepción en Meta. */
export function trackMetaEvent(
  pixelId: string,
  event: MetaEventName,
  data: MetaEventData = {},
  eventId?: string,
): boolean {
  if (typeof window === 'undefined' || !isMetaPixelId(pixelId)) return false;

  try {
    const key = event === 'Purchase' && eventId ? `taupoc:meta:${pixelId}:${eventId}` : null;
    if (key) {
      if (purchases.has(key)) return true;
      try {
        if (window.localStorage.getItem(key)) return true;
      } catch { /* Algunos navegadores bloquean el almacenamiento. */ }
    }

    // trackSingle evita enviar la conversión a otros píxeles instalados por GTM.
    const fbq = initialize(pixelId);
    if (eventId) fbq('trackSingle', pixelId, event, data, { eventID: eventId });
    else fbq('trackSingle', pixelId, event, data);

    if (key) {
      purchases.add(key);
      try { window.localStorage.setItem(key, '1'); } catch { /* Deduplicación en memoria. */ }
    }
    return true;
  } catch {
    // Un bloqueador o un error de analítica nunca debe interrumpir la compra.
    return false;
  }
}

export function metaCartData(cart: {
  lines: { productId: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
}): MetaEventData {
  return {
    content_type: 'product',
    content_ids: [...new Set(cart.lines.map((line) => line.productId))],
    contents: cart.lines.map((line) => ({
      id: line.productId,
      quantity: line.quantity,
      item_price: line.unitPrice,
    })),
    num_items: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    value: Math.max(0, cart.subtotal - cart.discount),
    currency: 'CLP',
  };
}
