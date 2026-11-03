'use server';

import { redirect } from 'next/navigation';
import { startReturnFeeCheckout } from '@/lib/order-returns';
import { rateLimit } from '@/lib/rate-limit';

/** El cliente aprieta "Pagar con Mercado Pago": se arma la preferencia y se va a pagar. */
export async function payReturnFee(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const back = `/devoluciones/pago/${encodeURIComponent(token)}`;
  let url: string | null = null;
  // Cada clic crea una preferencia en Mercado Pago: se frena el abuso del enlace.
  if (!rateLimit(`return-fee:${token}`, 10, 10 * 60_000)) redirect(`${back}?estado=espera`);
  try {
    const result = await startReturnFeeCheckout(token);
    if (result.ok) url = result.url;
  } catch (error) {
    console.error('[devolucion:pago:error]', error);
  }
  redirect(url ?? `${back}?estado=error`);
}
