export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Search';

export type MetaEventData = Record<string, unknown>;

export const DEFAULT_META_PIXEL_ID = '1302438768639889';

export function resolveMetaPixelId(value: unknown): string {
  const pixelId = typeof value === 'string' ? value.trim() : '';
  return isMetaPixelId(pixelId) ? pixelId : DEFAULT_META_PIXEL_ID;
}

interface PixelFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  disablePushState?: boolean;
  queue: unknown[][];
  push: PixelFunction;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
    __taupocMetaPixel?: { pixelId: string; pageView: string };
  }
}

const initialized = new Set<string>();
const purchases = new Set<string>();

export function isMetaPixelId(value: string): boolean {
  return /^\d+$/.test(value);
}

/** Código base oficial, incluido en el HTML para funcionar antes de React. */
export function metaPixelBootstrap(value: string): string | null {
  const pixelId = value.trim();
  if (!isMetaPixelId(pixelId)) return null;
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq.disablePushState=true;
fbq('init',${JSON.stringify(pixelId)});
fbq('track','PageView');
window.__taupocMetaPixel={pixelId:${JSON.stringify(pixelId)},pageView:window.location.pathname+(window.location.search?'?'+new URLSearchParams(window.location.search).toString():'')};`;
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
    // PageViews ya registra la navegación del cliente; sin esto Meta la duplica.
    fbq.disablePushState = true;
    window.fbq = fbq;
    window._fbq ??= fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  if (!initialized.has(pixelId)) {
    if (window.__taupocMetaPixel?.pixelId !== pixelId) window.fbq('init', pixelId);
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

/** Reconoce la visita enviada desde el HTML y evita repetirla al hidratar. */
export function trackMetaPageView(pixelId: string, url: string): boolean {
  if (typeof window === 'undefined' || !isMetaPixelId(pixelId)) return false;
  const previous = window.__taupocMetaPixel;
  if (previous?.pixelId === pixelId && previous.pageView === url) return true;
  if (!trackMetaEvent(pixelId, 'PageView')) return false;
  window.__taupocMetaPixel = { pixelId, pageView: url };
  return true;
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
