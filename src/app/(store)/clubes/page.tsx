import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { QuoteForm } from '@/components/store/QuoteForm';
import { IconBox, IconRuler, IconTruck, IconUsers } from '@/components/ui/Icons';

export const metadata: Metadata = buildMetadata({
  title: 'Clubes y equipos — cotización por volumen',
  description:
    'Precios por volumen para clubes de natación en Chile desde 10 unidades, con asesoría de tallas ' +
    'para el plantel completo y entrega coordinada en sede o torneo.',
  path: '/clubes',
});

const BENEFITS = [
  { icon: IconUsers, title: 'Desde 10 unidades', body: 'Descuento escalonado por volumen. Mientras más nadadores, mejor el precio unitario.' },
  { icon: IconRuler, title: 'Asesoría de tallas', body: 'Vamos a la sede o al torneo con el muestrario completo y medimos al plantel.' },
  { icon: IconTruck, title: 'Entrega coordinada', body: 'En la sede del club o en nuestro stand del torneo, sin costo de despacho.' },
  { icon: IconBox, title: 'Reposición garantizada', body: 'Reservamos stock de las tallas de tu equipo para la temporada completa.' },
];

export default function ClubsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-ink-900">
        <div className="absolute inset-0 bg-grid-tech bg-grid-tech opacity-60" aria-hidden />
        <div className="container relative py-16 lg:py-20">
          <p className="eyebrow-accent mb-4">Clubes y equipos</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[0.98] tracking-tightest text-chalk sm:text-[48px]">
            Equipa a todo tu plantel con trajes homologados.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-chalk-dim">
            Trabajamos con clubes federados en todo Chile. Cotizamos por volumen, asesoramos con las
            tallas de cada nadador y coordinamos la entrega donde te sirva.
          </p>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container py-12 lg:py-16">
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="bg-ink p-6 lg:p-7">
                <benefit.icon className="h-6 w-6 accent-text" />
                <h2 className="mt-5 font-display text-[14px] tracking-tight text-chalk">{benefit.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-chalk-faint">{benefit.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container py-14 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <h2 className="font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[32px]">
                Cómo funciona
              </h2>
              <ol className="mt-7 space-y-6">
                {[
                  ['Nos escribes', 'Cuéntanos cuántos nadadores son, qué modelos te interesan y para qué fecha los necesitas.'],
                  ['Cotizamos', 'Te respondemos en menos de 24 horas hábiles con precio unitario por volumen y disponibilidad real de tallas.'],
                  ['Medimos al plantel', 'Coordinamos una visita con el muestrario, o te enviamos la guía de medición para que la tomes tú.'],
                  ['Entregamos', 'En la sede del club o en el stand del torneo. Facturamos a nombre del club si lo necesitas.'],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border accent-border font-display text-[13px] font-bold accent-text">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-[14px] uppercase tracking-wide text-chalk">{title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-chalk-faint">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <QuoteForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
