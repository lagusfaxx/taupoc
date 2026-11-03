import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCart } from '@/lib/cart';
import { getCurrentFx } from '@/lib/fx-server';
import { formatUsdCents } from '@/lib/fx';
import { intlLine } from '@/lib/intl-checkout';
import { intlMetadata } from '@/lib/intl-seo';
import { CartQuantity } from '@/components/intl/CartQuantity';
import { isStudioImage } from '@/lib/intl-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = intlMetadata({ title: 'Carrito', description: 'Tu carrito.', path: '/carrito', noIndex: true });

export default async function IntlCartPage() {
  const [cart, fx] = await Promise.all([getCart(), getCurrentFx()]);
  const lines = fx ? cart.lines.map((l) => ({ ...l, ...intlLine(l, fx) })) : [];
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);

  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[clamp(40px,6vw,80px)] leading-[0.95]">Carrito</h1>

      {lines.length === 0 ? (
        <div className="mt-10">
          <p className="text-[17px] text-graphite-soft">Tu carrito está vacío.</p>
          <Link href="/catalogo" className="mt-6 inline-block text-[15px] text-cobalt underline underline-offset-4">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <ul>
            {lines.map((l) => (
              <li key={l.itemId} className="flex gap-5 border-t border-hairline py-6">
                <div className="relative h-32 w-28 shrink-0 bg-paper">
                  {isStudioImage(l.imageUrl) ? <Image src={l.imageUrl} alt="" fill sizes="112px" className="object-contain" /> : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="flex justify-between gap-4 text-[16px]">
                    <div>
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-graphite-soft">
                        {l.colorName} · Talla {l.size}
                      </p>
                      {l.overStock ? (
                        <p role="alert" className="mt-1 text-[14px] text-graphite">
                          Quedan {l.available}. Ajusta la cantidad.
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0">{formatUsdCents(l.lineCents)}</p>
                  </div>
                  <CartQuantity itemId={l.itemId} quantity={l.quantity} max={Math.min(5, Math.max(l.available, l.quantity))} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 lg:mt-0">
            <div className="border-t border-hairline pt-6 text-[16px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatUsdCents(subtotal)}</span>
              </div>
              <p className="mt-2 text-[14px] text-graphite-soft">
                El envío se calcula con tu dirección en el siguiente paso. Precios en dólares.
              </p>
              {cart.hasIssues ? (
                <p className="mt-6 text-[15px] text-graphite">Ajusta las cantidades para continuar.</p>
              ) : (
                <a
                  href="/checkout"
                  className="mt-6 flex h-14 items-center justify-center bg-cobalt text-[16px] font-medium text-white transition-colors hover:bg-cobalt-hover"
                >
                  Continuar al pago
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
