import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCart } from '@/lib/cart';
import { getCurrentFx } from '@/lib/fx-server';
import { intlLine } from '@/lib/intl-checkout';
import { intlMetadata } from '@/lib/intl-seo';
import { enviaCountries } from '@/lib/envia';
import { IntlCheckoutForm } from '@/components/intl/CheckoutForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = intlMetadata({ title: 'Pagar', description: 'Pago del pedido.', path: '/checkout', noIndex: true });

export default async function IntlCheckoutPage() {
  const [cart, fx, countries] = await Promise.all([getCart(), getCurrentFx(), enviaCountries()]);
  if (cart.lines.length === 0 || !fx) redirect('/carrito');

  const lines = cart.lines.map((l) => ({
    itemId: l.itemId,
    name: l.productName,
    detail: `${l.colorName} · Talla ${l.size}`,
    quantity: l.quantity,
    lineCents: intlLine(l, fx).lineCents,
  }));

  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[clamp(40px,6vw,80px)] leading-[0.95]">Pagar</h1>
      <IntlCheckoutForm
        lines={lines}
        subtotalCents={lines.reduce((s, l) => s + l.lineCents, 0)}
        countries={countries.filter((c) => c.code !== 'CL')}
      />
    </section>
  );
}
