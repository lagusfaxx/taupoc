import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { WholesaleForm } from '@/components/shared/WholesaleForm';

export const metadata: Metadata = buildMetadata({
  title: 'Venta por mayor — trajes de competencia para tiendas',
  description:
    'Precios mayoristas de trajes de competencia TAUPOC homologados World Aquatics para tiendas deportivas ' +
    'y de natación en Chile. Pide la lista de precios.',
  path: '/venta-por-mayor',
  intlPath: '/venta-por-mayor',
});

const POINTS = [
  ['Precio mayorista', 'Lista de precios por volumen para revender.'],
  ['Mezcla libre', 'Combina modelos, colores y tallas en el mismo pedido.'],
  ['Despacho a todo Chile', 'Enviamos a tu tienda con factura.'],
  ['Fotos para tu catálogo', 'Te pasamos las fotos y fichas de cada modelo.'],
];

export default function WholesalePage() {
  return (
    <>
      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-20">
          <p className="eyebrow-accent mb-3">Venta por mayor</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[48px]">
            Vende TAUPOC en tu tienda
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-chalk-dim">
            Trajes de competencia homologados por World Aquatics a precio mayorista.
          </p>
        </div>
      </section>

      <section>
        <div className="container py-14 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <dl className="divide-y divide-line border-y border-line">
                {POINTS.map(([title, body]) => (
                  <div key={title} className="py-5">
                    <dt className="font-display text-[14px] uppercase tracking-wide text-chalk">{title}</dt>
                    <dd className="mt-1.5 text-[14.5px] leading-relaxed text-chalk-faint">{body}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 text-[14px] text-chalk-faint">
                ¿Compras para un club?{' '}
                <Link href="/clubes" className="underline underline-offset-4 hover:text-chalk">
                  Cotiza como club
                </Link>
                .
              </p>
            </div>
            <WholesaleForm market="CL" theme="dark" />
          </div>
        </div>
      </section>
    </>
  );
}
