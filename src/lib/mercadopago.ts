import 'server-only';
import crypto from 'crypto';
import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from 'mercadopago';
import type { PaymentStatus } from '@prisma/client';

/**
 * Integración con Mercado Pago (Checkout Pro).
 *
 * MP_MODE controla el ambiente:
 *   test → credenciales de prueba, no cobra dinero real
 *   live → producción
 * En ambos casos se usa MP_ACCESS_TOKEN; el propio token indica el ambiente
 * (los de prueba empiezan con TEST-). MP_MODE se usa para avisos en el panel
 * y para relajar la validación de firma en pruebas locales.
 */

export function mpMode(): 'test' | 'live' {
  return process.env.MP_MODE === 'live' ? 'live' : 'test';
}

export function mpConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function client(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN no está configurado. Revisa las variables de entorno.');
  }
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 10000 },
  });
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export interface PreferenceItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  pictureUrl?: string | null;
}

export interface CreatePreferenceInput {
  orderId: string;
  orderNumber: string;
  items: PreferenceItem[];
  shippingCost: number;
  discount: number;
  payer: { name: string; surname?: string; email: string; phone?: string };
  maxInstallments: number;
}

/**
 * Crea la preferencia de pago. El descuento se envía como un ítem negativo
 * porque Checkout Pro no acepta un campo de descuento a nivel de preferencia.
 */
export async function createPreference(input: CreatePreferenceInput) {
  const preference = new Preference(client());
  const base = siteUrl();

  const items = input.items.map((i) => ({
    id: i.id,
    title: i.title.slice(0, 250),
    description: (i.description ?? '').slice(0, 250),
    quantity: i.quantity,
    unit_price: i.unitPrice,
    currency_id: 'CLP',
    picture_url: i.pictureUrl ? `${base}${i.pictureUrl}` : undefined,
  }));

  if (input.shippingCost > 0) {
    items.push({
      id: 'envio',
      title: 'Despacho',
      description: 'Costo de envío',
      quantity: 1,
      unit_price: input.shippingCost,
      currency_id: 'CLP',
      picture_url: undefined,
    });
  }
  if (input.discount > 0) {
    items.push({
      id: 'descuento',
      title: 'Descuento aplicado',
      description: 'Cupón',
      quantity: 1,
      unit_price: -input.discount,
      currency_id: 'CLP',
      picture_url: undefined,
    });
  }

  const response = await preference.create({
    body: {
      items,
      external_reference: input.orderId,
      statement_descriptor: 'TAUPOC CHILE',
      payer: {
        name: input.payer.name,
        surname: input.payer.surname,
        email: input.payer.email,
        phone: input.payer.phone
          ? { area_code: '', number: input.payer.phone.replace(/\D/g, '') }
          : undefined,
      },
      back_urls: {
        success: `${base}/checkout/resultado?order=${input.orderNumber}`,
        pending: `${base}/checkout/resultado?order=${input.orderNumber}`,
        failure: `${base}/checkout/resultado?order=${input.orderNumber}`,
      },
      auto_return: 'approved',
      notification_url: `${base}/api/webhooks/mercadopago`,
      payment_methods: {
        installments: input.maxInstallments,
        excluded_payment_types: [],
      },
      metadata: { order_number: input.orderNumber },
      // Las preferencias caducan a las 24 h para liberar el stock reservado.
      expires: true,
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  return {
    id: response.id!,
    initPoint: (mpMode() === 'live'
      ? response.init_point
      : (response.sandbox_init_point ?? response.init_point))!,
  };
}

export interface MpPaymentInfo {
  id: string;
  status: PaymentStatus;
  statusDetail: string | null;
  externalReference: string | null;
  paymentTypeId: string | null;
  installments: number | null;
  transactionAmount: number | null;
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  pending: 'PENDING',
  in_process: 'IN_PROCESS',
  in_mediation: 'IN_PROCESS',
  authorized: 'IN_PROCESS',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  charged_back: 'CHARGED_BACK',
};

export function mapPaymentStatus(raw?: string | null): PaymentStatus {
  return STATUS_MAP[String(raw ?? '').toLowerCase()] ?? 'PENDING';
}

export async function getPayment(paymentId: string): Promise<MpPaymentInfo | null> {
  const payment = new Payment(client());
  const data = await payment.get({ id: paymentId });
  if (!data?.id) return null;
  return {
    id: String(data.id),
    status: mapPaymentStatus(data.status),
    statusDetail: data.status_detail ?? null,
    externalReference: data.external_reference ?? null,
    paymentTypeId: data.payment_type_id ?? null,
    installments: data.installments ?? null,
    transactionAmount: data.transaction_amount ?? null,
  };
}

/** Reembolso total o parcial. Monto en CLP; omitir para reembolso total. */
export async function refundPayment(paymentId: string, amount?: number) {
  const refund = new PaymentRefund(client());
  return refund.create({
    payment_id: paymentId,
    body: amount ? { amount } : {},
  });
}

/**
 * Valida la firma del webhook (x-signature).
 * Manifiesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
export function verifyWebhookSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secretKey = process.env.MP_WEBHOOK_SECRET;
  // Sin secreto configurado no se puede validar; se acepta pero la ruta
  // igualmente consulta el pago contra la API antes de tocar el pedido.
  if (!secretKey) return true;
  if (!params.signature || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.signature.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k.trim(), rest.join('=').trim()];
    }),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId ?? ''};ts:${ts};`;
  const computed = crypto.createHmac('sha256', secretKey).update(manifest).digest('hex');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
