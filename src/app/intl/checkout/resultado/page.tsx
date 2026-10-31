import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatUsdCents } from '@/lib/fx';
import { intlMetadata } from '@/lib/intl-seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = intlMetadata({ title: 'Tu pedido', description: 'Estado del pedido.', path: '/checkout/resultado', noIndex: true });

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IntlResultPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const number = Array.isArray(params.order) ? params.order[0] : params.order;
  const estado = Array.isArray(params.estado) ? params.estado[0] : params.estado;
  if (!number) notFound();
  const order = await prisma.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || order.storefront !== 'INTL') notFound();

  const approved = order.paymentStatus === 'APPROVED';
  const title = approved
    ? 'Pago confirmado.'
    : estado === 'paypal-cancelado'
      ? 'El pago no se completó.'
      : estado === 'agotado'
        ? 'Se agotó una talla.'
        : estado === 'paypal-error'
          ? 'PayPal no pudo completar el cobro.'
          : 'Estamos confirmando tu pago.';
  const text = approved
    ? 'Preparamos tu envío y te escribimos con el número de seguimiento apenas salga.'
    : estado === 'paypal-cancelado'
      ? 'Cancelaste el pago en PayPal. No se te cobró nada; puedes volver al carrito e intentarlo de nuevo.'
      : estado === 'agotado'
        ? 'Mientras pagabas se agotó una de las tallas de tu pedido, así que no te cobramos nada.'
        : estado === 'paypal-error'
          ? 'Si se descontó dinero de tu cuenta, escríbenos con el número de pedido y lo revisamos.'
          : 'PayPal está revisando el pago. Te avisamos por correo cuando se acredite.';

  return (
    <section className="mx-auto max-w-[900px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <p className="text-[13px] text-graphite-soft">Pedido {order.number}</p>
      <h1 className="mt-3 text-[clamp(40px,6vw,80px)] leading-[0.95]">{title}</h1>
      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-graphite-soft">{text}</p>

      <ul className="mt-12 border-t border-hairline text-[16px]">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 border-b border-hairline py-4">
            <span>
              {i.productName}
              <span className="block text-graphite-soft">
                {i.colorName} · Talla {i.size} · {i.quantity} u.
              </span>
            </span>
          </li>
        ))}
      </ul>
      {order.chargedCents ? (
        <p className="mt-6 flex justify-between text-[18px] font-medium">
          <span>Total</span>
          <span>{formatUsdCents(order.chargedCents)}</span>
        </p>
      ) : null}
      <p className="mt-2 text-[14px] text-graphite-soft">
        Envío a {[order.city, order.region, order.country].filter(Boolean).join(', ')} · {order.shippingCarrier} {order.shippingLabel}
      </p>

      <div className="mt-12 flex gap-6 text-[15px]">
        {!approved && estado ? (
          <a href="/carrito" className="text-cobalt underline underline-offset-4">
            Volver al carrito
          </a>
        ) : null}
        <Link href="/catalogo" className="text-cobalt underline underline-offset-4">
          Seguir viendo
        </Link>
      </div>
    </section>
  );
}
