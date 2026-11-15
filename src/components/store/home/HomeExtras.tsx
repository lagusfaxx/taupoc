import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getProductsByIds } from '@/lib/catalog';
import { ProductCard, type ProductCardData } from '@/components/store/ProductCard';
import { Stars } from '@/components/ui/Stars';
import { IconArrow } from '@/components/ui/Icons';

/** Encabezado común de las secciones de la portada. */
export function HomeHeading({
  eyebrow,
  title,
  subtitle,
  link,
}: {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  link?: { href: string; label: string } | null;
}) {
  if (!title && !eyebrow) return null;
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-9">
      <div>
        {eyebrow ? <p className="eyebrow-accent">{eyebrow}</p> : null}
        {title ? (
          <h2 className="mt-2 font-display text-[26px] leading-none tracking-tightest text-chalk lg:text-[34px]">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-chalk-dim">{subtitle}</p>
        ) : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:text-chalk"
        >
          {link.label}
          <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Lo más vendido de los últimos 90 días, por color. Se arma sola desde los
 * pedidos pagados; si todavía no hay ventas suficientes, la sección no sale.
 */
export async function BestSellers() {
  const since = new Date(Date.now() - 90 * 86400_000);
  const rows = await prisma.orderItem.groupBy({
    by: ['productId', 'colorName'],
    where: { productId: { not: null }, order: { paymentStatus: 'APPROVED', createdAt: { gte: since } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 12,
  });
  if (rows.length < 4) return null;

  const products = await getProductsByIds([...new Set(rows.map((r) => r.productId as string))]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const cards: ProductCardData[] = [];
  for (const row of rows) {
    const product = byId.get(row.productId as string);
    const color = product?.colors.find((c) => c.name === row.colorName);
    // Un más vendido agotado no ayuda a nadie a comprar.
    if (!product || !color || color.stock === 0 || product.comingSoon) continue;
    cards.push(
      product.colors.length > 1
        ? { ...product, id: `${product.id}:${color.slug}`, colorSlug: color.slug, fallbackImage: color.imageUrl ?? product.fallbackImage }
        : product,
    );
    if (cards.length === 4) break;
  }
  if (cards.length < 4) return null;

  return (
    <section className="border-t border-line">
      <div className="container py-12 lg:py-16">
        <HomeHeading
          eyebrow="Los más vendidos"
          title="Lo que están eligiendo"
          subtitle="Los colores que más se llevaron en los últimos tres meses, con tallas disponibles hoy."
          link={{ href: '/catalogo', label: 'Ver catálogo' }}
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {cards.map((card, i) => (
            <div key={card.id} className="relative">
              <span className="absolute right-2.5 top-2.5 z-10 rounded-[3px] bg-ink px-2 py-1 font-display text-[11px] font-bold tracking-wide text-chalk">
                N.º {i + 1}
              </span>
              <ProductCard product={card} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Reseñas publicadas con texto. Con menos de dos, la sección no sale. */
export async function ReviewsStrip() {
  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where: { status: 'PUBLISHED', rating: { gte: 4 }, body: { not: '' } },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: {
        id: true, rating: true, title: true, body: true, authorName: true, authorNote: true, verified: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    prisma.review.aggregate({ where: { status: 'PUBLISHED' }, _avg: { rating: true }, _count: true }),
  ]);
  if (reviews.length < 2) return null;
  const average = agg._avg.rating ?? 0;

  return (
    <section className="border-t border-line bg-ink-900">
      <div className="container py-12 lg:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 lg:mb-9">
          <div>
            <p className="eyebrow-accent">Reseñas</p>
            <h2 className="mt-2 font-display text-[26px] leading-none tracking-tightest text-chalk lg:text-[34px]">
              Lo que dicen quienes compiten con TAUPOC
            </h2>
          </div>
          <p className="flex items-center gap-2.5 text-[14px] text-chalk-dim">
            <Stars value={average} />
            <strong className="text-chalk">{average.toFixed(1).replace('.', ',')}</strong>
            de 5 · {agg._count} {agg._count === 1 ? 'reseña' : 'reseñas'}
          </p>
        </div>

        <ul className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col rounded-[6px] border border-line bg-ink-800 p-5 lg:p-6">
              <Stars value={review.rating} size="sm" />
              {review.title ? (
                <p className="mt-3 text-[15px] font-semibold leading-snug text-chalk">{review.title}</p>
              ) : null}
              <p className="mt-2 line-clamp-5 text-[14px] leading-relaxed text-chalk-dim">{review.body}</p>
              <div className="mt-auto pt-5 text-[12.5px] text-chalk-faint">
                <p>
                  <span className="font-semibold text-chalk">{review.authorName}</span>
                  {review.authorNote ? ` · ${review.authorNote}` : ''}
                  {review.verified ? ' · Compra verificada' : ''}
                </p>
                <Link
                  href={`/producto/${review.product.slug}`}
                  className="mt-1 inline-block underline underline-offset-4 hover:text-chalk"
                >
                  {review.product.name}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
