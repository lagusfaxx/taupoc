import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductDetail, getRelated, resumenDeNotas, GENDER_LABEL } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { buildMetadata, jsonLd, absoluteUrl } from '@/lib/seo';
import { ProductView, type ProductViewData } from '@/components/store/ProductView';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductReviews } from '@/components/store/ProductReviews';
import { SectionHeading } from '@/components/store/SectionHeading';
import { Accordion } from '@/components/store/Accordion';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return buildMetadata({ title: 'Producto no encontrado', noIndex: true });

  return buildMetadata({
    title: product.seoTitle ?? `${product.name} ${product.modelCode}`,
    description:
      product.seoDescription ??
      `${product.name} de competición TAUPOC. Homologación ${product.approvalBody} ${product.approvalCode ?? ''}. Tallas 20 a 36 con stock en Chile.`,
    path: `/producto/${product.slug}`,
    image: product.colors[0]?.images[0]?.url ?? product.images[0]?.url ?? null,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductDetail(slug), getSettings()]);
  if (!product) notFound();

  const rating = resumenDeNotas(product.reviews);
  const esAccesorio = product.kind === 'ACCESSORY';

  const colors = product.colors.map((color) => ({
    id: color.id,
    name: color.name,
    code: color.code,
    slug: color.slug,
    hex: color.hex,
    accentHex: color.accentHex,
    stripCode: color.stripCode,
    stripHex: color.stripHex,
    images: color.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
    variants: color.variants.map((v) => {
      const available = Math.max(0, v.stock - v.reserved);
      return {
        id: v.id,
        size: v.size,
        sku: v.sku,
        available,
        price: v.priceOverride ?? product.basePrice,
      };
    }),
  }));

  const viewData: ProductViewData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    modelCode: product.modelCode,
    subtitle: product.subtitle,
    lineName: product.line?.name ?? null,
    genderLabel: GENDER_LABEL[product.gender],
    gender: product.gender,
    basePrice: product.basePrice,
    approvalCode: product.approvalCode,
    approvalBody: product.approvalBody,
    approvalYear: product.approvalYear,
    approvalVerifyUrl: product.approvalVerifyUrl,
    comingSoon: product.status === 'COMING_SOON',
    esAccesorio,
    fitNotes: product.fitNotes,
    fitOffset: product.fitOffset,
    colors,
    sizeChart: product.sizeChart.map((r) => ({
      size: r.size,
      chestMinCm: r.chestMinCm, chestMaxCm: r.chestMaxCm,
      waistMinCm: r.waistMinCm, waistMaxCm: r.waistMaxCm,
      hipMinCm: r.hipMinCm, hipMaxCm: r.hipMaxCm,
      heightMinCm: r.heightMinCm, heightMaxCm: r.heightMaxCm,
      cn: r.cn, usa: r.usa, uk: r.uk, aus: r.aus, nz: r.nz,
    })),
    fallbackImages: product.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
    installmentsMax: settings.installmentsMax,
    freeShippingOver: settings.freeShippingOver,
    rating,
  };

  const totalStock = colors.reduce(
    (s, c) => s + c.variants.reduce((cs, v) => cs + v.available, 0),
    0,
  );

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description.split('\n')[0],
    sku: product.modelCode,
    mpn: product.modelCode,
    brand: { '@type': 'Brand', name: 'TAUPOC' },
    category: product.category?.name,
    image: product.colors
      .flatMap((c) => c.images.map((i) => absoluteUrl(i.url)))
      .slice(0, 8),
    ...(product.approvalCode && !esAccesorio
      ? {
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: 'Homologación World Aquatics',
              value: product.approvalCode,
            },
          ],
        }
      : {}),
    // Solo con reseñas de verdad: Google exige que el marcado refleje lo que
    // se ve en la página, y una nota inventada es motivo de sanción manual.
    ...(rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.average,
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: product.reviews.slice(0, 10).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.authorName },
            datePublished: r.publishedAt.toISOString().slice(0, 10),
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            ...(r.title ? { name: r.title } : {}),
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'CLP',
      lowPrice: product.basePrice,
      highPrice: product.basePrice,
      offerCount: colors.reduce((s, c) => s + c.variants.length, 0),
      availability:
        product.status === 'COMING_SOON'
          ? 'https://schema.org/PreOrder'
          : totalStock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/producto/${product.slug}`),
      seller: { '@type': 'Organization', name: 'TAUPOC Chile' },
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: absoluteUrl('/catalogo') },
      { '@type': 'ListItem', position: 3, name: product.name, item: absoluteUrl(`/producto/${product.slug}`) },
    ],
  };

  const techSections = [
    product.composition ? { label: 'Composición', value: product.composition } : null,
    product.construction ? { label: 'Construcción', value: product.construction } : null,
    product.finish ? { label: 'Acabado', value: product.finish } : null,
    product.countryOrigin ? { label: 'Origen', value: product.countryOrigin } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumb)} />

      <nav aria-label="Ruta de navegación" className="border-b border-line-soft">
        <ol className="container flex items-center gap-2 py-3.5 text-[12px] text-chalk-faint">
          <li><Link href="/" className="hover:text-chalk">Inicio</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/catalogo" className="hover:text-chalk">Catálogo</Link></li>
          <li aria-hidden>/</li>
          <li className="truncate text-chalk-dim">{product.name}</li>
        </ol>
      </nav>

      <div className="container py-8 lg:py-14">
        <ProductView product={viewData} />
      </div>

      {/* Descripción y ficha técnica */}
      <section className="border-t border-line bg-ink-900">
        <div className="container py-14 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <p className="eyebrow-accent mb-4">
                {esAccesorio ? 'Sobre este producto' : 'Sobre este traje'}
              </p>
              <div className="prose-taupoc max-w-xl">
                {product.description.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {techSections.length > 0 ? (
                <dl className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
                  {techSections.map((item) => (
                    <div key={item.label} className="bg-ink-900 p-5">
                      <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                        {item.label}
                      </dt>
                      <dd className="mt-2 text-[14px] leading-relaxed text-chalk-dim">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            <div>
              <Accordion
                items={[
                  ...(product.specs.length > 0
                    ? [
                        {
                          title: 'Ficha técnica completa',
                          defaultOpen: true,
                          content: (
                            <dl className="divide-y divide-line-soft">
                              {product.specs.map((spec) => (
                                <div key={spec.id} className="flex justify-between gap-6 py-2.5">
                                  <dt className="text-[13.5px] text-chalk-faint">{spec.label}</dt>
                                  <dd className="text-right text-[13.5px] font-medium text-chalk">
                                    {spec.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ),
                        },
                      ]
                    : []),
                  ...(product.colors.some((c) => c.code || c.stripCode)
                    ? [
                        {
                          title: 'Colorways y vivos',
                          content: (
                            <ul className="divide-y divide-line-soft">
                              {product.colors.map((color) => (
                                <li key={color.id} className="flex items-center gap-3 py-2.5">
                                  <span
                                    className="h-4 w-4 shrink-0 border border-line-bright"
                                    style={{ background: color.hex }}
                                    aria-hidden
                                  />
                                  <span className="flex-1 text-[13.5px] text-chalk-dim">{color.name}</span>
                                  {color.code ? (
                                    <span className="font-mono text-[12.5px] text-chalk">{color.code}</span>
                                  ) : null}
                                  {color.stripCode ? (
                                    <span className="font-mono text-[12.5px] text-chalk-faint">
                                      vivo {color.stripCode}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                      ]
                    : []),
                  ...(product.fitNotes && !esAccesorio
                    ? [
                        {
                          title: 'Cómo debe calzar',
                          content: (
                            <div className="space-y-3 text-[14px] leading-relaxed text-chalk-dim">
                              <p>{product.fitNotes}</p>
                              <p>
                                Al ponértelo, sube el tejido de a poco con las palmas abiertas, nunca con
                                las uñas. Reserva entre 10 y 15 minutos la primera vez.
                              </p>
                            </div>
                          ),
                        },
                      ]
                    : []),
                  ...(product.careNotes
                    ? [
                        {
                          title: 'Cuidado y vida útil',
                          content: (
                            <p className="text-[14px] leading-relaxed text-chalk-dim">{product.careNotes}</p>
                          ),
                        },
                      ]
                    : []),
                  {
                    title: 'Despacho y cambios',
                    content: (
                      <div className="space-y-3 text-[14px] leading-relaxed text-chalk-dim">
                        <p>
                          Despachamos a todo Chile con Chilexpress, Starken y Correos de Chile. El plazo va
                          de 1 a 8 días hábiles según la región.
                        </p>
                        <p>
                          Puedes retirar sin costo en Santiago o coordinar la entrega en nuestro stand del
                          próximo torneo.
                        </p>
                        <p>
                          Cambio de talla sin costo dentro de 10 días con el traje sin uso y con etiqueta.
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <ProductReviews reviews={product.reviews} average={rating.average} productName={product.name} />

      {/* Los relacionados van en streaming: son una consulta más y quedan
          fuera de la primera pantalla, así que esperarlos solo retrasaba la
          compra. */}
      <Suspense fallback={<RelatedSkeleton />}>
        <Related productId={product.id} lineId={product.lineId} />
      </Suspense>
    </>
  );
}

function RelatedShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-t border-line">
      <div className="container py-14 lg:py-20">
        <SectionHeading
          eyebrow="También te puede servir"
          title="Completa tu equipamiento"
          link={{ href: '/catalogo', label: 'Ver catálogo' }}
        />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {children}
        </div>
      </div>
    </section>
  );
}

function RelatedSkeleton() {
  return (
    <RelatedShell>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5] w-full" />
          <div className="mt-3.5 skeleton h-4 w-3/4" />
          <div className="mt-3.5 skeleton h-4 w-24" />
        </div>
      ))}
    </RelatedShell>
  );
}

async function Related({ productId, lineId }: { productId: string; lineId: string | null }) {
  const related = await getRelated(productId, lineId, 4);
  if (related.length === 0) return null;

  return (
    <RelatedShell>
      {related.map((item) => (
        <ProductCard key={item.id} product={item} />
      ))}
    </RelatedShell>
  );
}
