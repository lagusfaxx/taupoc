import Link from 'next/link';
import type { Metadata } from 'next';
import { colorPagePath, getCatalog, splitCardsByColor } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { LANDING_LINKS, type Landing } from '@/lib/landings';
import { absoluteUrl, buildMetadata, jsonLd } from '@/lib/seo';
import { ProductCard } from '@/components/store/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { IconArrow } from '@/components/ui/Icons';

export function landingMetadata(landing: Landing): Metadata {
  return buildMetadata({ title: landing.title, description: landing.description, path: landing.path });
}

/**
 * Plantilla de las páginas de aterrizaje: texto visible, los productos que
 * responden la búsqueda y un FAQ que se muestra con el mismo texto que va en
 * el JSON-LD. Cada tarjeta enlaza a la ficha de su color, así las fichas que
 * Google todavía no indexa reciben enlaces desde páginas con contenido.
 */
export async function LandingPage({ landing }: { landing: Landing }) {
  // Sin género se piden los dos por separado: así quedan fuera los accesorios.
  const [found, settings] = await Promise.all([
    landing.gender
      ? getCatalog({ gender: landing.gender, sizes: landing.sizes })
      : Promise.all([
          getCatalog({ gender: 'MALE', sizes: landing.sizes }),
          getCatalog({ gender: 'FEMALE', sizes: landing.sizes }),
        ]).then(([men, women]) => [...women, ...men]),
    getSettings(),
  ]);

  const products = settings.catalogSplitByColor ? splitCardsByColor(found) : found;
  const fromPrice = found.length > 0 ? Math.min(...found.map((p) => p.basePrice)) : null;

  const productUrl = (p: (typeof products)[number]) => {
    const color = p.colorSlug ? p.colors.find((c) => c.slug === p.colorSlug) : null;
    return color ? colorPagePath(p.slug, color.slug) : `/producto/${p.slug}`;
  };

  const grafo = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: landing.h1, item: absoluteUrl(landing.path) },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: landing.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      ...(products.length > 0
        ? [
            {
              '@type': 'ItemList',
              name: landing.productsTitle,
              numberOfItems: products.length,
              itemListElement: products.slice(0, 20).map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(productUrl(p)),
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(grafo)} />

      <nav aria-label="Ruta de navegación" className="border-b border-line-soft">
        <ol className="container flex items-center gap-2 py-3.5 text-[12px] text-chalk-faint">
          <li><Link href="/" className="hover:text-chalk">Inicio</Link></li>
          <li aria-hidden>/</li>
          <li className="text-chalk-dim">{landing.h1}</li>
        </ol>
      </nav>

      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-20">
          <p className="eyebrow-accent mb-3">{landing.eyebrow}</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[48px]">
            {landing.h1}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-chalk-dim">{landing.intro}</p>
          {fromPrice != null ? (
            <p className="mt-4 text-[14px] text-chalk-faint">
              Desde <span className="font-display font-semibold text-chalk">{formatCLP(fromPrice)}</span> ·
              Tallas con stock en Chile · Despacho a todo el país
            </p>
          ) : null}
        </div>
      </section>

      {products.length > 0 ? (
        <section className="border-b border-line">
          <div className="container py-12 lg:py-16">
            <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
              {landing.productsTitle}
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
              {products.map((product, i) => (
                <ProductCard key={`${product.id}-${product.colorSlug ?? ''}`} product={product} priority={i < 4} />
              ))}
            </div>
            <Link
              href="/catalogo"
              className="group mt-8 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-text"
            >
              Ver todo el catálogo
              <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="border-b border-line">
        <div className="container py-14 lg:py-18">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {landing.sections.map((section) => (
              <div key={section.title}>
                <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
                  {section.title}
                </h2>
                {section.paragraphs.map((p) => (
                  <p key={p} className="mt-4 text-[15px] leading-relaxed text-chalk-dim">{p}</p>
                ))}
                {section.bullets ? (
                  <ul className="mt-5 space-y-2.5">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-3 text-[14px] leading-relaxed text-chalk-dim">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 accent-bg" aria-hidden />
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-18">
          <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
            Preguntas frecuentes
          </h2>
          <dl className="mt-7 max-w-3xl divide-y divide-line border-y border-line">
            {landing.faq.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-display text-[15px] font-semibold tracking-tight text-chalk">{f.q}</dt>
                <dd className="mt-2 text-[14.5px] leading-relaxed text-chalk-dim">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <div className="container flex flex-col gap-8 py-12 lg:flex-row lg:items-start lg:justify-between lg:py-14">
          <div>
            <h2 className="font-display text-[22px] leading-none tracking-tight text-chalk">También te puede servir</h2>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
              {landing.related.map((href) => (
                <li key={href}>
                  <Link href={href} className="text-[14.5px] text-chalk-dim underline underline-offset-4 hover:text-chalk">
                    {LANDING_LINKS[href] ?? href}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/contacto" size="lg" className="shrink-0">
            Asesoría de talla
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
