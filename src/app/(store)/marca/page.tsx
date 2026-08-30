import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildMetadata, jsonLd } from '@/lib/seo';
import { SectionHeading } from '@/components/store/SectionHeading';
import { ButtonLink } from '@/components/ui/Button';
import { IconShield, IconExternal } from '@/components/ui/Icons';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'La marca y la homologación World Aquatics',
  description:
    'Qué es TAUPOC, por qué somos su distribuidor oficial en Chile y qué significa realmente que un traje ' +
    'esté homologado por World Aquatics.',
  path: '/marca',
});

const RULES = [
  { title: 'Espesor máximo', body: 'El material no puede superar el espesor permitido en ningún punto del traje.' },
  { title: 'Flotabilidad nula', body: 'El traje no puede aportar empuje adicional al nadador. Se mide en laboratorio.' },
  { title: 'Permeabilidad', body: 'El tejido debe permitir el paso de agua dentro de los rangos definidos por la norma.' },
  { title: 'Cobertura', body: 'Hombre: del ombligo a la rodilla. Mujer: sin cubrir cuello, sin pasar del hombro ni de la rodilla.' },
  { title: 'Sin elementos externos', body: 'Cierres, broches, piezas rígidas o sistemas de sujeción están prohibidos.' },
  { title: 'Disponibilidad pública', body: 'El modelo debe estar disponible comercialmente para cualquier nadador, no solo para un equipo.' },
];

export default async function BrandPage() {
  const products = await prisma.product.findMany({
    where: { approvalCode: { not: null }, status: { in: ['ACTIVE', 'COMING_SOON'] } },
    select: { name: true, slug: true, modelCode: true, approvalCode: true, approvalYear: true, status: true },
    orderBy: { sortOrder: 'asc' },
  });

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Qué significa que un traje esté homologado por World Aquatics?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Significa que el modelo fue evaluado y aprobado por World Aquatics y figura en su lista pública ' +
            'de trajes aprobados. Solo esos modelos pueden usarse en competencia oficial.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Cómo verifico el código de homologación de mi traje?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'El código está impreso en el traje y publicado en la ficha de cada producto. Puedes buscarlo en ' +
            'la lista oficial de trajes aprobados de World Aquatics.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Qué pasa si compito con un traje no homologado?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'El juez árbitro puede impedir la partida o descalificar al nadador. No hay apelación posible ' +
            'en el momento de la carrera.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faq)} />

      <section className="relative overflow-hidden border-b border-line bg-ink-900">
        <div className="absolute inset-0 bg-grid-tech bg-grid-tech opacity-60" aria-hidden />
        <div className="container relative py-16 lg:py-24">
          <p className="eyebrow-accent mb-4">La marca</p>
          <h1 className="max-w-3xl text-balance font-display text-[36px] leading-[0.98] tracking-tightest text-chalk sm:text-[52px] lg:text-[64px]">
            Equipamiento de competencia, no ropa de playa.
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-[16px] leading-relaxed text-chalk-dim">
            TAUPOC fabrica trajes de competición con tejido técnico italiano y construcción termosellada.
            Nosotros somos su distribuidor oficial en Chile: importamos, mantenemos disponibilidad de las
            tallas más pedidas y acompañamos a nadadores, clubes y entrenadores en todo el país.
          </p>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[32px]">
                Por qué existimos
              </h2>
              <div className="prose-taupoc mt-6">
                <p>
                  En Chile, un traje de competición de marca internacional cuesta entre dos y tres veces
                  lo que cuesta en Europa o Estados Unidos. Y aun pagándolo, la talla que necesita el
                  nadador casi nunca está: los quiebres de stock son permanentes, y reponer toma meses.
                </p>
                <p>
                  Eso deja a los clubes chilenos en una posición absurda: nadadores que entrenan diez
                  sesiones semanales compitiendo con trajes prestados, de talla equivocada, o directamente
                  con el traje de entrenamiento.
                </p>
                <p>
                  Trajimos TAUPOC a Chile para cerrar esa brecha. Mismo estándar de homologación oficial,
                  disponibilidad y un precio que un club puede sostener a lo largo de una temporada.
                </p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[32px]">
                Cómo trabajamos
              </h2>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {[
                  ['Bodega en Chile', 'Bodega propia en Santiago. Lo que aparece disponible se despacha el mismo día hábil.'],
                  ['Presencia en torneos', 'Stand con muestrario completo de tallas en las fechas del calendario nacional.'],
                  ['Asesoría de talla', 'Te ayudamos con las medidas antes de comprar. Es la principal causa de devolución del rubro.'],
                  ['Condiciones para clubes', 'Precio por volumen, facturación al club y entrega coordinada en sede o torneo.'],
                ].map(([title, body]) => (
                  <div key={title} className="py-4">
                    <dt className="font-display text-[13px] uppercase tracking-wide text-chalk">{title}</dt>
                    <dd className="mt-1.5 text-[14px] leading-relaxed text-chalk-faint">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="homologacion" className="scroll-mt-24 border-b border-line bg-ink-900">
        <div className="container py-16 lg:py-24">
          <SectionHeading
            eyebrow="Normativa"
            title="Qué significa la homologación World Aquatics"
            description="No es un sello de marketing. Es un registro público que determina si el nadador puede competir."
          />

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-16">
            <div>
              <div className="prose-taupoc">
                <p>
                  World Aquatics —el ente rector de la natación mundial, antes conocido como FINA— mantiene
                  una lista pública de trajes aprobados para competencia. Cada modelo aprobado recibe un
                  código único que se imprime en la prenda.
                </p>
                <p>
                  En un campeonato oficial, el juez árbitro puede pedir revisar el traje antes de la salida.
                  Si el modelo no está en la lista, el nadador no larga. Esto ocurre con más frecuencia de
                  lo que se cree con trajes comprados en marketplaces internacionales, donde circulan
                  réplicas y modelos cuya aprobación ya venció.
                </p>
                <h3>Qué controla la norma</h3>
              </div>

              <ul className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-2">
                {RULES.map((rule) => (
                  <li key={rule.title} className="bg-ink-900 p-5">
                    <p className="font-display text-[12px] uppercase tracking-wide text-chalk">{rule.title}</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-chalk-faint">{rule.body}</p>
                  </li>
                ))}
              </ul>

              <div className="prose-taupoc mt-8">
                <h3>Cómo verificarlo tú mismo</h3>
                <p>
                  No confíes en que la tienda te lo diga, incluidos nosotros. Toma el código, entra a la
                  lista oficial de trajes aprobados de World Aquatics y búscalo. Deben coincidir el
                  fabricante, el modelo y el año de aprobación.
                </p>
              </div>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="surface">
                <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                  <IconShield className="h-5 w-5 accent-text" />
                  <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk">
                    Nuestros códigos
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {products.map((product) => (
                    <li key={product.slug}>
                      <Link href={`/producto/${product.slug}`} className="block px-5 py-4 transition-colors hover:bg-ink-800">
                        <p className="font-display text-[13.5px] font-semibold tracking-tight text-chalk">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-chalk-faint">
                          Modelo {product.modelCode}
                          {product.approvalYear ? ` · Aprobado ${product.approvalYear}` : ''}
                          {product.status === 'COMING_SOON' ? ' · Próximamente' : ''}
                        </p>
                        <p className="mt-2 font-mono text-[15px] tracking-wider accent-text">
                          {product.approvalCode}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line p-5">
                  <a
                    href="https://www.worldaquatics.com/swimming/approved-swimwear"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest accent-text underline underline-offset-4"
                  >
                    Lista oficial World Aquatics
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-[28px] leading-tight tracking-tightest text-chalk sm:text-[36px]">
              ¿Compras para un club o un equipo?
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
              Trabajamos con condiciones especiales por volumen desde 10 unidades, con asesoría de tallas
              para el plantel completo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/clubes" size="lg">Pedir cotización</ButtonLink>
              <ButtonLink href="/catalogo" variant="outline" size="lg">Ver catálogo</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
