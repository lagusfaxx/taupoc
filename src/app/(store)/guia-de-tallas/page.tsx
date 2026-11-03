import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildMetadata, jsonLd } from '@/lib/seo';
import { SizeGuideTables } from '@/components/store/SizeGuideTables';
import { ButtonLink } from '@/components/ui/Button';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Guía de tallas de trajes de competición',
  description:
    'Tabla de tallas TAUPOC en cm con equivalencias USA, UK, AUS y NZ, y cuántas tallas bajar para competir.',
  path: '/guia-de-tallas',
});

const STEPS = [
  ['Cintura', 'En la parte más angosta del torso, sin contraer el abdomen.'],
  ['Cadera', 'En la parte más ancha, con los pies juntos.'],
  ['Pecho', 'Bajo las axilas, en la parte más ancha. Solo knee suit.'],
  ['Estatura', 'Descalzo, con la espalda contra la pared.'],
];

const ADJUST = [
  ['Entrenamiento / principiantes', 'Tu talla', 'La de la tabla.'],
  ['Competencia / avanzados', 'Baja 1 a 2 tallas', 'Más compresión.'],
];

export default async function SizeGuidePage() {
  const products = await prisma.product.findMany({
    where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
    include: { sizeChart: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ gender: 'asc' }, { sortOrder: 'asc' }],
  });

  // Una tabla por género: las medidas son iguales dentro de cada género.
  const byGender = new Map<string, (typeof products)[number]>();
  for (const product of products) {
    if (product.sizeChart.length > 0 && !byGender.has(product.gender)) {
      byGender.set(product.gender, product);
    }
  }

  const charts = [...byGender.entries()].map(([gender, product]) => ({
    gender: gender as 'MALE' | 'FEMALE' | 'UNISEX',
    label: gender === 'MALE' ? 'Hombre — Jammer' : gender === 'FEMALE' ? 'Mujer — Knee suit' : 'Unisex',
    rows: product.sizeChart.map((r) => ({
      size: r.size,
      chestMinCm: r.chestMinCm, chestMaxCm: r.chestMaxCm,
      waistMinCm: r.waistMinCm, waistMaxCm: r.waistMaxCm,
      hipMinCm: r.hipMinCm, hipMaxCm: r.hipMaxCm,
      heightMinCm: r.heightMinCm, heightMaxCm: r.heightMaxCm,
      cn: r.cn, usa: r.usa, uk: r.uk, aus: r.aus, nz: r.nz,
    })),
  }));

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Cómo elegir la talla de un traje de competición',
    step: [
      ...STEPS.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: `Medir ${s[0].toLowerCase()}`,
        text: s[1],
      })),
      {
        '@type': 'HowToStep',
        position: STEPS.length + 1,
        name: 'Elegir según el uso',
        text: 'Para entrenamiento usa tu talla; para competencia baja 1 a 2 tallas.',
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(howTo)} />

      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-20">
          <p className="eyebrow-accent mb-3">Guía técnica</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[48px]">
            Cómo elegir tu talla de competición
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-chalk-dim">
            Los trajes de competición van ajustados. Mide cintura y cadera, busca tu talla en la tabla y
            ajústala según el uso.
          </p>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container py-14 lg:py-18">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
                1 · Toma las medidas
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
                Con huincha, de pie y sin ropa gruesa.
              </p>
              <dl className="mt-7 divide-y divide-line border-y border-line">
                {STEPS.map(([title, body]) => (
                  <div key={title} className="py-4">
                    <dt className="font-display text-[13px] uppercase tracking-wide text-chalk">{title}</dt>
                    <dd className="mt-1.5 text-[14px] leading-relaxed text-chalk-faint">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
                2 · Elige según el uso
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
                Recomendación oficial de TAUPOC sobre la talla de la tabla.
              </p>
              <div className="mt-7 table-scroll">
                <table className="w-full min-w-[440px] border-collapse text-[14px]">
                  <thead>
                    <tr>
                      <th className="border-b border-line px-3 py-2.5 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">Uso</th>
                      <th className="border-b border-line px-3 py-2.5 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">Ajuste</th>
                      <th className="border-b border-line px-3 py-2.5 text-left font-display text-[10px] uppercase tracking-widest text-chalk-faint">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ADJUST.map(([prueba, ajuste, motivo]) => (
                      <tr key={prueba}>
                        <td className="border-b border-line-soft px-3 py-3 text-chalk">{prueba}</td>
                        <td className="border-b border-line-soft px-3 py-3 font-display text-[13px] font-semibold accent-text">{ajuste}</td>
                        <td className="border-b border-line-soft px-3 py-3 text-[13px] text-chalk-faint">{motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-18">
          <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
            3 · Tablas de tallas
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-chalk-dim">
            Medidas del cuerpo en centímetros.
          </p>
          <div className="mt-8">
            <SizeGuideTables charts={charts} />
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container py-14 lg:py-18">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
                Cómo ponerse el traje
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
                La mayoría de las roturas ocurre al ponérselo.
              </p>
              <ol className="mt-6 space-y-4">
                {[
                  'Uñas cortas o guantes de algodón. Las uñas rompen el bonding.',
                  'Entra con una pierna a la vez, sin apuro.',
                  'Sube el tejido con las palmas abiertas, en tramos de cinco centímetros, alternando lados.',
                  'Reserva entre 10 y 15 minutos la primera vez.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border accent-border font-display text-[11px] font-bold accent-text">
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-relaxed text-chalk-dim">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
                Cuidado y vida útil
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
                Bien cuidado, rinde entre 25 y 30 carreras.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Enjuaga con agua fría inmediatamente después de cada uso.',
                  'Seca a la sombra, extendido, nunca colgado de los tirantes.',
                  'No uses lavadora, secadora, cloro ni suavizante.',
                  'No lo guardes enrollado ni húmedo dentro del bolso.',
                  'Guárdalo plano, no doblado en el mismo pliegue.',
                ].map((tip) => (
                  <li key={tip} className="relative pl-5 text-[14px] leading-relaxed text-chalk-dim">
                    <span className="absolute left-0 top-[0.6em] h-[5px] w-[5px] accent-bg" aria-hidden />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container py-14 lg:py-18">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[34px]">
              ¿Sigues con dudas de talla?
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
              Envíanos las medidas y la prueba, y te decimos qué talla pedir.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contacto" size="lg">Consultar mi talla</ButtonLink>
              <ButtonLink href="/catalogo" variant="outline" size="lg">Ver catálogo</ButtonLink>
            </div>
            <p className="mt-6 text-[13px] text-chalk-faint">
              También puedes leer{' '}
              <Link href="/blog/como-elegir-la-talla-de-tu-traje-de-competicion" className="underline underline-offset-4 hover:text-chalk">
                la guía completa en el blog
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
