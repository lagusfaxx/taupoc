import type { Metadata } from 'next';
import Link from 'next/link';
import { getCart } from '@/lib/cart';
import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { buildMetadata } from '@/lib/seo';
import { CartLineItem } from '@/components/store/CartLineItem';
import { CouponForm } from '@/components/store/CouponForm';
import { Empty } from '@/components/ui/Empty';
import { ButtonLink } from '@/components/ui/Button';
import { IconCart, IconShield, IconTruck } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Tu carrito',
  path: '/carrito',
  noIndex: true,
});

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getSettings()]);

  if (cart.lines.length === 0) {
    return (
      <div className="container py-20 lg:py-28">
        <div className="mx-auto max-w-lg">
          <Empty
            icon={<IconCart className="h-10 w-10" />}
            title="Tu carrito está vacío"
            description="Revisa el catálogo de competición: nueve tallas, stock real y homologación World Aquatics verificable."
            action={<ButtonLink href="/catalogo" size="lg">Ver catálogo</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const total = cart.subtotal - cart.discount;
  const gap = settings.freeShippingOver ? settings.freeShippingOver - cart.subtotal : null;
  const progress =
    settings.freeShippingOver && settings.freeShippingOver > 0
      ? Math.min(100, Math.round((cart.subtotal / settings.freeShippingOver) * 100))
      : null;

  return (
    <div className="container py-10 lg:py-16">
      <h1 className="font-display text-[30px] leading-none tracking-tightest text-chalk sm:text-[40px]">
        Tu carrito
      </h1>
      <p className="mt-2.5 text-[14px] text-chalk-faint">
        {cart.itemCount} {cart.itemCount === 1 ? 'producto' : 'productos'}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div>
          {/* Barra de progreso hacia envío gratis */}
          {progress != null && settings.freeShippingOver ? (
            <div className="mb-8 border border-line bg-ink-900 p-4">
              <p className="text-[13.5px] text-chalk-dim">
                {gap && gap > 0 ? (
                  <>
                    Te faltan <strong className="accent-text">{formatCLP(gap)}</strong> para el despacho sin costo.
                  </>
                ) : (
                  <strong className="text-signal-ok">Tienes despacho sin costo en este pedido.</strong>
                )}
              </p>
              <div className="mt-3 h-1 w-full bg-ink-700">
                <div
                  className="h-full accent-bg transition-all duration-500 ease-tech"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => (
              <CartLineItem key={line.itemId} line={line} />
            ))}
          </ul>

          <Link
            href="/catalogo"
            className="mt-6 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim hover:accent-text"
          >
            ← Seguir comprando
          </Link>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-6">
            <h2 className="font-display text-[13px] uppercase tracking-widest text-chalk">
              Resumen del pedido
            </h2>

            <div className="mt-5">
              <CouponForm appliedCode={cart.couponCode} error={cart.couponError} />
            </div>

            <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Subtotal</dt>
                <dd className="text-chalk">{formatCLP(cart.subtotal)}</dd>
              </div>
              {cart.discount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-chalk-faint">Descuento</dt>
                  <dd className="text-signal-ok">−{formatCLP(cart.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-chalk-faint">Despacho</dt>
                <dd className="text-chalk-faint">
                  {cart.couponFreeShipping ? 'Gratis' : 'Se calcula al pagar'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
              <span className="font-display text-[13px] uppercase tracking-widest text-chalk">Total</span>
              <span className="font-display text-[26px] font-bold tracking-tight accent-text">
                {formatCLP(total)}
              </span>
            </div>

            {cart.hasIssues ? (
              <p className="mt-4 border border-signal-warn/40 bg-signal-warn/10 px-3 py-2.5 text-[13px] text-signal-warn">
                Ajusta las cantidades marcadas antes de continuar al pago.
              </p>
            ) : null}

            <ButtonLink
              href="/checkout"
              size="lg"
              full
              className={cart.hasIssues ? 'pointer-events-none opacity-45' : 'mt-5'}
            >
              Continuar al pago
            </ButtonLink>

            <ul className="mt-6 space-y-3 border-t border-line pt-5">
              <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
                <IconShield className="mt-0.5 h-4 w-4 shrink-0" />
                Pago seguro con Mercado Pago. Aceptamos crédito, débito y cuotas.
              </li>
              <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-chalk-faint">
                <IconTruck className="mt-0.5 h-4 w-4 shrink-0" />
                Elige despacho a domicilio, retiro en Santiago o entrega en torneo.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
