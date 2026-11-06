import type { Metadata } from 'next';
import { intlMetadata } from '@/lib/intl-seo';
import { WholesaleForm } from '@/components/shared/WholesaleForm';

export const metadata: Metadata = intlMetadata({
  title: 'Venta por mayor — trajes de competencia para tiendas',
  description:
    'Precios mayoristas de trajes de competencia TAUPOC homologados World Aquatics para tiendas de natación ' +
    'en Latinoamérica. Pide la lista de precios.',
  path: '/venta-por-mayor',
  clPath: '/venta-por-mayor',
});

const POINTS = [
  ['Precio mayorista', 'Lista de precios en dólares por volumen.'],
  ['Mezcla libre', 'Combina modelos, colores y tallas en el mismo pedido.'],
  ['Envío a tu país', 'Despachamos a toda Latinoamérica.'],
  ['Fotos para tu catálogo', 'Te pasamos las fotos y fichas de cada modelo.'],
];

export default function IntlWholesalePage() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="max-w-[16ch] text-[clamp(40px,6vw,88px)] leading-[0.95]">Vende TAUPOC en tu tienda</h1>
      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-graphite-soft">
        Trajes de competencia homologados por World Aquatics a precio mayorista.
      </p>
      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <dl className="self-start border-t border-hairline">
          {POINTS.map(([title, body]) => (
            <div key={title} className="border-b border-hairline py-5">
              <dt className="text-[17px] text-graphite">{title}</dt>
              <dd className="mt-1 text-[15px] text-graphite-soft">{body}</dd>
            </div>
          ))}
        </dl>
        <WholesaleForm market="INTL" theme="light" />
      </div>
    </section>
  );
}
