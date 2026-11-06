import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getIntlProduct } from '@/lib/intl-catalog';
import { intlMetadata } from '@/lib/intl-seo';
import { formatUsdCents } from '@/lib/fx';
import { cn } from '@/lib/utils';
import { AddToCart } from '@/components/intl/AddToCart';
import { ProductGallery } from '@/components/intl/ProductGallery';
import { ProductDeliveryEstimate } from '@/components/intl/DeliveryEstimate';
import { IntlSizeTable } from '@/components/intl/SizeTable';
import { intlUrl } from '@/lib/intl-seo';
import { jsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getIntlProduct(slug);
  if (!view || 'redirectTo' in view) return {};
  const { product, color, images } = view;
  const kind = product.gender === 'FEMALE' ? 'knee suit' : 'jammer';
  return intlMetadata({
    title: `${product.name} ${color.name} — ${kind} homologado World Aquatics`,
    description:
      `${product.name} en ${color.name}: ${kind} de competencia TAUPOC homologado por World Aquatics` +
      `${product.approvalCode ? ` (${product.approvalCode})` : ''}. Envío a toda Latinoamérica y pago en dólares.`,
    path: `/producto/${slug}`,
    clPath: `/producto/${slug}`,
    image: images[0]?.url,
  });
}

export default async function IntlProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const view = await getIntlProduct(slug);
  if (!view) notFound();
  if ('redirectTo' in view) permanentRedirect(view.redirectTo);

  const { product, color, images, priceCents, sizes, colors } = view;
  const anyAvailable = sizes.some((s) => s.available > 0);
  const kind = product.gender === 'FEMALE' ? 'Mujer' : 'Hombre';
  const pagePath = `/producto/${slug}`;
  const totalAvailable = sizes.reduce((s, v) => s + v.available, 0);
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${product.name} ${color.name}`,
    description: product.description.split('\n')[0],
    sku: color.code ?? `${product.modelCode}-${color.slug}`,
    mpn: product.modelCode,
    color: color.name,
    inProductGroupWithID: product.modelCode,
    brand: { '@type': 'Brand', name: 'TAUPOC' },
    image: images.slice(0, 8).map((i) => intlUrl(i.url)),
    ...(product.approvalCode
      ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Homologación World Aquatics', value: product.approvalCode },
          ],
        }
      : {}),
    ...(priceCents != null
      ? {
          offers: {
            '@type': 'Offer',
            url: intlUrl(pagePath),
            priceCurrency: 'USD',
            price: (priceCents / 100).toFixed(2),
            availability:
              product.status === 'COMING_SOON'
                ? 'https://schema.org/PreOrder'
                : totalAvailable > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: 'TAUPOC' },
          },
        }
      : {}),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: intlUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: kind,
        item: intlUrl(`/catalogo?genero=${product.gender === 'FEMALE' ? 'mujer' : 'hombre'}`),
      },
      { '@type': 'ListItem', position: 3, name: `${product.name} ${color.name}`, item: intlUrl(pagePath) },
    ],
  };
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productLd)} />
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />
    <article className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div>
        <ProductGallery
          images={images.map((i) => ({ url: i.url, alt: i.alt }))}
          fallbackAlt={`${product.name} ${color.name}`}
        />
      </div>

      <div className="mt-6 lg:mt-0">
        <div className="lg:sticky lg:top-28">
          <p className="text-[13px] text-graphite-soft">{product.line?.name ?? 'TAUPOC'}</p>
          <h1 className="mt-1 text-[30px] leading-[0.98] lg:mt-2 lg:text-[clamp(36px,4vw,56px)]">
            {product.name}
          </h1>
          <p className="mt-1.5 text-[16px] text-graphite-soft lg:mt-3 lg:text-[17px]">
            {color.name}
          </p>

          <p className="mt-4 text-[22px] lg:mt-8 text-graphite">
            {product.status === 'COMING_SOON'
              ? 'Próximamente'
              : priceCents != null
                ? formatUsdCents(priceCents)
                : 'Precio por confirmar'}
          </p>
          <p className="mt-1 text-[13px] text-graphite-soft">
            <span className="lg:hidden">
              En dólares. Impuestos de importación por cuenta del comprador.
            </span>
            <span className="hidden lg:inline">
              Precio en dólares. Impuestos y derechos de importación del país de destino por cuenta
              del comprador.
            </span>
          </p>

          {colors.length > 1 ? (
            <div className="mt-6 lg:mt-10">
              <p className="text-[13px] text-graphite-soft">Color</p>
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {colors.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={c.href}
                      aria-label={`${c.name}${c.available ? '' : ', agotado'}`}
                      aria-current={c.current ? 'page' : undefined}
                      title={c.name}
                      className={cn(
                        // El contorno interior fino hace visible el blanco sobre el papel.
                        'block h-8 w-8 rounded-full shadow-[inset_0_0_0_1px_rgba(17,18,20,0.12)] ring-offset-2 ring-offset-paper',
                        c.current ? 'ring-1 ring-graphite' : 'hover:ring-1 hover:ring-hairline',
                        !c.available && 'opacity-35',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {product.status === 'ACTIVE' && anyAvailable ? (
            <AddToCart
              sizes={sizes}
              product={{ name: product.name, color: color.name, imageUrl: images[0]?.url ?? null }}
            />
          ) : (
            <p className="mt-6 text-[15px] lg:mt-10 text-graphite-soft">
              {product.status === 'COMING_SOON'
                ? 'Disponible muy pronto.'
                : 'Este color está agotado por ahora.'}
            </p>
          )}

          {product.kind !== 'ACCESSORY' ? (
            <IntlSizeTable
              rows={product.sizeChart.map((r) => ({
                size: r.size,
                chestMinCm: r.chestMinCm,
                chestMaxCm: r.chestMaxCm,
                waistMinCm: r.waistMinCm,
                waistMaxCm: r.waistMaxCm,
                hipMinCm: r.hipMinCm,
                hipMaxCm: r.hipMaxCm,
                heightMinCm: r.heightMinCm,
                heightMaxCm: r.heightMaxCm,
                usa: r.usa,
              }))}
            />
          ) : null}

          {product.status === 'ACTIVE' && anyAvailable ? (
            <ProductDeliveryEstimate productId={product.id} detailed />
          ) : null}

          {paragraphs.length > 0 ? (
            <div className="mt-12 space-y-4 text-[16px] leading-relaxed text-graphite">
              {paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          ) : null}

          {product.specs.length > 0 || product.approvalCode ? (
            <dl className="mt-12 text-[15px]">
              {product.approvalCode ? (
                <div className="flex justify-between gap-6 border-t border-hairline py-3.5">
                  <dt className="text-graphite-soft">{product.approvalBody}</dt>
                  <dd className="text-right text-graphite">{product.approvalCode}</dd>
                </div>
              ) : null}
              {product.specs.map((spec) => (
                <div
                  key={spec.id}
                  className="flex justify-between gap-6 border-t border-hairline py-3.5"
                >
                  <dt className="text-graphite-soft">{spec.label}</dt>
                  <dd className="text-right text-graphite">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </article>
    </>
  );
}
