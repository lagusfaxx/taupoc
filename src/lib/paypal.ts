import 'server-only';
import { siteUrl } from './mercadopago';

/**
 * Cobro con PayPal (Orders v2) para los pedidos internacionales.
 *
 * Flujo de redirección, sin SDK en el navegador: se crea la orden, el
 * comprador la aprueba en paypal.com y vuelve a /api/paypal/retorno, donde se
 * captura el pago. La tienda sigue llevando todo en CLP; a PayPal se le cobra
 * en USD con el tipo de cambio configurado.
 *
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */

const LIVE = process.env.PAYPAL_MODE === 'live';
const API = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && usdRate());
}

export function paypalMode(): 'live' | 'sandbox' {
  return LIVE ? 'live' : 'sandbox';
}

/** Pesos por dólar. PAYPAL_USD_TO_CLP, o el mismo que usa Envía. */
export function usdRate(): number {
  const rate = Number(process.env.PAYPAL_USD_TO_CLP || process.env.ENVIA_USD_TO_CLP);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** CLP → centavos de dólar, redondeando hacia arriba para no cobrar de menos. */
export function clpToUsdCents(clp: number, rate = usdRate()): number {
  if (!rate) throw new Error('Falta el tipo de cambio USD/CLP.');
  return Math.ceil((clp / rate) * 100);
}

export function formatUsd(cents: number): string {
  return `US$ ${(cents / 100).toFixed(2)}`;
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PayPal token ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call<T>(path: string, init: { method: string; body?: unknown; requestId?: string }): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotencia: reintentar la misma llamada no duplica la orden ni el cobro.
      ...(init.requestId ? { 'PayPal-Request-Id': init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`PayPal ${init.method} ${path} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

interface PaypalOrder {
  id: string;
  status: string;
  links?: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: { captures?: Array<{ id: string; status: string; amount?: { currency_code: string; value: string } }> };
  }>;
}

/**
 * Verifica con PayPal que un webhook es auténtico. Necesita PAYPAL_WEBHOOK_ID,
 * el identificador del webhook que se registra en el panel de desarrollador
 * de PayPal; sin él el webhook queda apagado.
 *
 * Docs: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post
 */
export async function verifyPaypalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const header = (name: string) => headers.get(name) ?? '';
  const result = await call<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: header('paypal-auth-algo'),
      cert_url: header('paypal-cert-url'),
      transmission_id: header('paypal-transmission-id'),
      transmission_sig: header('paypal-transmission-sig'),
      transmission_time: header('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return result.verification_status === 'SUCCESS';
}

/** Crea la orden en PayPal y devuelve el enlace donde el comprador paga. */
export async function createPaypalOrder(input: {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  /** Dominio al que vuelve el comprador. Por defecto, taupoc.cl. */
  baseUrl?: string;
  /** Nombre que muestra PayPal. Por defecto, "TAUPOC Chile". */
  brandName?: string;
}): Promise<{ id: string; approveUrl: string }> {
  const base = input.baseUrl ?? siteUrl();
  const order = await call<PaypalOrder>('/v2/checkout/orders', {
    method: 'POST',
    requestId: `create-${input.orderId}`,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          invoice_id: input.orderNumber,
          description: `${input.brandName ?? 'TAUPOC Chile'} · Pedido ${input.orderNumber}`,
          amount: { currency_code: 'USD', value: (input.amountCents / 100).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: input.brandName ?? 'TAUPOC Chile',
            locale: 'es-CL',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${base}/api/paypal/retorno`,
            // Pasa por el servidor para soltar la reserva de stock al tiro.
            cancel_url: `${base}/api/paypal/cancelado?order=${input.orderNumber}`,
          },
        },
      },
    },
  });
  const approveUrl = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  if (!approveUrl) throw new Error(`PayPal no devolvió enlace de pago: ${JSON.stringify(order)}`);
  return { id: order.id, approveUrl };
}

/** Captura una orden aprobada. Si ya estaba capturada, devuelve su estado. */
export async function capturePaypalOrder(paypalOrderId: string): Promise<{
  status: string;
  captureId: string | null;
  orderId: string | null;
  currency: string | null;
  cents: number | null;
}> {
  let order: PaypalOrder;
  try {
    order = await call<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      requestId: `capture-${paypalOrderId}`,
    });
  } catch (error) {
    // Volver dos veces al retorno (recargar) intenta capturar de nuevo:
    // se consulta la orden y se usa lo que ya quedó registrado.
    console.warn('[paypal:capture]', error);
    order = await call<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { method: 'GET' });
  }
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    status: capture?.status ?? order.status,
    captureId: capture?.id ?? null,
    orderId: unit?.reference_id ?? null,
    currency: capture?.amount?.currency_code ?? null,
    cents: capture?.amount ? Math.round(Number(capture.amount.value) * 100) : null,
  };
}
