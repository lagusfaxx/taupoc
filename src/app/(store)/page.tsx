import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getFeatured } from '@/lib/catalog';
import { getHomeBlocks } from '@/lib/home';
import { buildMetadata, jsonLd, absoluteUrl, SITE_NAME } from '@/lib/seo';
import { ProductCard } from '@/components/store/ProductCard';
import { HomeBlocks } from '@/components/store/home/HomeBlocks';
import { ButtonLink } from '@/components/ui/Button';
import { IconArrow } from '@/components/ui/Icons';

export const metadata: Metadata = buildMetadata({
  title: 'Trajes de competición homologados World Aquatics',
  description:
    'Distribuidor oficial TAUPOC en Chile. Jammers y knee suits de competición homologados por ' +
    'World Aquatics. Despacho a todo el país y retiro sin costo en Santiago.',
  path: '/',
});

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [settings, blocks] = await Promise.all([getSettings(), getHomeBlocks()]);

  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: SITE_NAME,
    description:
      'Distribuidor oficial de TAUPOC Swimwear en Chile. Trajes de competición homologados por World Aquatics.',
    url: absoluteUrl('/'),
    email: settings.contactEmail,
    telephone: settings.contactPhone,
    address: { '@type': 'PostalAddress', addressLocality: 'Santiago', addressCountry: 'CL' },
    currenciesAccepted: 'CLP',
    paymentAccepted: 'Tarjeta de crédito, tarjeta de débito, Mercado Pago',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(store)} />

      <h1 className="sr-only">
        TAUPOC Chile — trajes de competición homologados por World Aquatics
      </h1>

      {blocks.length > 0 ? <HomeBlocks blocks={blocks} /> : <PortadaPorDefecto />}
    </>
  );
}

/**
 * Portada mientras el panel no tenga bloques: catálogo, accesos por género y
 * línea, y el bloque de clubes. Se arma sola desde los productos, así que una
 * instalación nueva no queda en blanco.
 */
async function PortadaPorDefecto() {
  const [featured, lines] = await Promise.all([
    getFeatured(4),
    prisma.productLine.findMany({
      where: { active: true, slug: { in: ['r-skin', 'vel-skin'] } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
  ]);

  // Las portadas de categoría salen del propio catálogo, tomando un colorway
  // distinto en cada bloque para que los cuatro no se vean iguales.
  const covers = await prisma.productImage.findMany({
    where: {
      product: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
      color: { active: true },
      sortOrder: 0,
    },
    orderBy: [{ product: { sortOrder: 'asc' } }, { color: { sortOrder: 'asc' } }],
    select: {
      url: true,
      product: { select: { modelCode: true, gender: true, line: { select: { slug: true } } } },
      color: { select: { slug: true } },
    },
  });

  const pick = (
    modelCode: string,
    colorSlug: string,
    fallback: (i: (typeof covers)[number]) => boolean,
  ) =>
    covers.find((i) => i.product.modelCode === modelCode && i.color?.slug === colorSlug)?.url ??
    covers.find(fallback)?.url ??
    null;

  const entries = [
    {
      label: 'Hombre',
      href: '/catalogo?genero=MALE',
      imageUrl: pick('TS703', 'negro-9192', (i) => i.product.gender === 'MALE'),
    },
    {
      label: 'Mujer',
      href: '/catalogo?genero=FEMALE',
      imageUrl: pick('TS704', 'rosado-30049', (i) => i.product.gender === 'FEMALE'),
    },
    ...lines.map((line) => ({
      label: line.name,
      href: `/catalogo?linea=${line.slug}`,
      imageUrl:
        line.slug === 'r-skin'
          ? pick('TS703', 'azul-marino-60289', (i) => i.product.line?.slug === 'r-skin')
          : pick('TS706', 'purpura-50008', (i) => i.product.line?.slug === 'vel-skin'),
    })),
  ];

  return (
    <>
      <section className="container pb-10 pt-6 lg:pb-12 lg:pt-7">
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {featured.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>

        <Link
          href="/catalogo"
          className="group mt-8 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-text"
        >
          Ver catálogo
          <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </section>

      <section className="border-t border-line">
        <div className="container py-10 lg:py-12">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {entries.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="group relative block overflow-hidden border border-line bg-ink-800"
              >
                <div className="relative aspect-[3/4]">
                  {entry.imageUrl ? (
                    <Image
                      src={entry.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 45vw, 24vw"
                      className="object-cover transition-transform duration-700 ease-tech group-hover:scale-[1.05]"
                    />
                  ) : null}
                  <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                </div>

                <span className="absolute inset-x-0 bottom-0 p-4 font-display text-[20px] leading-none tracking-tight text-chalk lg:text-[24px]">
                  {entry.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-ink-900">
        <div className="container flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-14">
          <div>
            <h2 className="font-display text-[22px] leading-none tracking-tight text-chalk">Clubes</h2>
            <p className="mt-2.5 max-w-xl text-[14.5px] leading-relaxed text-chalk-dim">
              Precio por volumen desde 10 unidades, con asesoría de tallas para el plantel y entrega
              en la sede o en el torneo.
            </p>
          </div>
          <ButtonLink href="/clubes" size="lg" className="shrink-0">
            Cotización para clubes
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
