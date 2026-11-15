/**
 * Analítica propia de la tienda, lado del navegador.
 *
 * Manda al servidor qué páginas se ven para que el panel pueda armar el embudo
 * (visitas → fichas → carrito → pago → pedido) y decir de dónde llega la
 * gente. No usa cookies ni guarda datos personales: los identificadores son
 * números al azar que viven en el almacenamiento del navegador.
 */

export type TrackType = 'PAGE_VIEW' | 'PRODUCT_VIEW' | 'CHECKOUT_START' | 'PURCHASE';

const VISITOR_KEY = 'tp_vid';
const SESSION_KEY = 'tp_sid';
const SOURCE_KEY = 'tp_src';
/** Media hora sin actividad cierra la sesión, como en cualquier analítica. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

const SOCIAL: [RegExp, string][] = [
  [/google\./, 'google'],
  [/bing\.|duckduckgo\.|yahoo\./, 'buscadores'],
  [/instagram\./, 'instagram'],
  [/facebook\.|fb\.|messenger\./, 'facebook'],
  [/tiktok\./, 'tiktok'],
  [/whatsapp\.|wa\.me/, 'whatsapp'],
  [/youtube\.|youtu\.be/, 'youtube'],
  [/mercadolibre\./, 'mercadolibre'],
  [/chatgpt\.|openai\.|perplexity\.|claude\.ai/, 'ia'],
];

/** De dónde llega la visita: campaña etiquetada, clic de anuncio o referente. */
export function detectSource(search: string, referrer: string, ownHost: string): { source: string; campaign: string | null } {
  const params = new URLSearchParams(search);
  const campaign = params.get('utm_campaign')?.slice(0, 80) || null;
  const utm = params.get('utm_source')?.trim().toLowerCase();
  if (utm) {
    const medium = params.get('utm_medium')?.toLowerCase() ?? '';
    const paid = /cpc|paid|ads/.test(medium);
    if (/^(ig|instagram)/.test(utm)) return { source: paid ? 'meta-ads' : 'instagram', campaign };
    if (/^(fb|facebook|meta)/.test(utm)) return { source: paid ? 'meta-ads' : 'facebook', campaign };
    if (/^google/.test(utm)) return { source: paid ? 'google-ads' : 'google', campaign };
    return { source: utm.replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'campaña', campaign };
  }
  if (params.get('gclid') || params.get('gbraid') || params.get('wbraid')) return { source: 'google-ads', campaign };
  if (params.get('fbclid')) return { source: 'meta-ads', campaign };

  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  if (!host || host === ownHost) return { source: 'direct', campaign };
  for (const [pattern, name] of SOCIAL) if (pattern.test(host)) return { source: name, campaign };
  return { source: host.replace(/^www\./, '').slice(0, 40), campaign };
}

function identity() {
  const now = Date.now();
  let visitor = localStorage.getItem(VISITOR_KEY);
  if (!visitor) {
    visitor = randomId();
    localStorage.setItem(VISITOR_KEY, visitor);
  }

  let session: { id: string; at: number } | null = null;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    session = null;
  }
  const fresh = !session || now - session.at > SESSION_IDLE_MS;
  const id = fresh ? randomId() : session!.id;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }));

  let origin: { source: string; campaign: string | null } | null = null;
  if (!fresh) {
    try {
      origin = JSON.parse(localStorage.getItem(SOURCE_KEY) ?? 'null');
    } catch {
      origin = null;
    }
  }
  if (!origin) {
    origin = detectSource(location.search, document.referrer, location.hostname);
    localStorage.setItem(SOURCE_KEY, JSON.stringify(origin));
  }
  return { visitor, session: id, ...origin };
}

export function track(type: TrackType, extra: { productId?: string; orderNumber?: string } = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const who = identity();
    const body = JSON.stringify({
      t: type,
      v: who.visitor,
      s: who.session,
      p: location.pathname.slice(0, 200),
      src: who.source,
      cmp: who.campaign,
      pid: extra.productId,
      on: extra.orderNumber,
    });
    const sent = navigator.sendBeacon?.('/api/t', new Blob([body], { type: 'application/json' }));
    if (!sent) void fetch('/api/t', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true });
  } catch {
    // Navegación privada o almacenamiento bloqueado: la tienda sigue igual.
  }
}
