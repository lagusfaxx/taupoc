import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getIntlProduct } from '@/lib/intl-catalog';
import { intlMetadata } from '@/lib/intl-seo';
import { formatUsdCents } from '@/lib/fx';
import { cn } from '@/lib/utils';

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
  const paragraphs = product.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_460px]">
      {/* Fotografía a todo lo ancho de la columna, una debajo de otra. */}
      <div className="space-y-4">
        {images.map((image, i) => (
          <div key={image.url} className="relative aspect-[4/5] bg-paper">
            <Image
              src={image.url}
              alt={image.alt || `${product.name} ${color.name}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-contain"
            />
          </div>
        ))}
      </div>

      <div className="mt-10 lg:mt-0">
        <div className="lg:sticky lg:top-8">
          <p className="text-[13px] text-graphite-soft">{product.line?.name ?? 'TAUPOC'}</p>
          <h1 className="mt-2 text-[clamp(36px,4vw,56px)] leading-[0.98]">{product.name}</h1>
          <p className="mt-3 text-[17px] text-graphite-soft">{color.name}</p>

          <p className="mt-8 text-[22px] text-graphite">
            {product.status === 'COMING_SOON'
              ? 'Próximamente'
              : priceCents != null
                ? formatUsdCents(priceCents)
                : 'Precio por confirmar'}
          </p>
          <p className="mt-1 text-[13px] text-graphite-soft">
            Precio en dólares. Impuestos y derechos de importación del país de destino por cuenta del comprador.
          </p>

          {colors.length > 1 ? (
            <div className="mt-10">
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

          <div className="mt-10">
            <p className="text-[13px] text-graphite-soft">Tallas</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[17px]">
              {sizes.map((s) => (
                <li
                  key={s.variantId}
                  className={s.available > 0 ? 'text-graphite' : 'text-graphite-faint line-through'}
                  aria-label={`Talla ${s.size}${s.available > 0 ? '' : ', agotada'}`}
                >
                  {s.size}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[15px] text-graphite-soft">
              {anyAvailable ? 'La compra en línea abre muy pronto.' : 'Este color está agotado por ahora.'}
            </p>
          </div>

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
                <div key={spec.id} className="flex justify-between gap-6 border-t border-hairline py-3.5">
                  <dt className="text-graphite-soft">{spec.label}</dt>
                  <dd className="text-right text-graphite">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </article>
  );
}
