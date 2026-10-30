import type { Metadata } from 'next';
import Link from 'next/link';
import type { Gender } from '@prisma/client';
import { getIntlCards } from '@/lib/intl-catalog';
import { intlMetadata } from '@/lib/intl-seo';
import { cn } from '@/lib/utils';
import { ProductGrid } from '@/components/intl/ProductGrid';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: { slug: string; gender: Gender | null; label: string; title: string }[] = [
  { slug: '', gender: null, label: 'Todo', title: 'Trajes de competencia' },
  { slug: 'hombre', gender: 'MALE', label: 'Hombre', title: 'Jammers de competencia' },
  { slug: 'mujer', gender: 'FEMALE', label: 'Mujer', title: 'Knee suits de competencia' },
];

function filterFor(value: string | string[] | undefined) {
  const slug = Array.isArray(value) ? value[0] : value;
  return FILTERS.find((f) => f.slug === slug) ?? FILTERS[0];
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const filter = filterFor((await searchParams).genero);
  return intlMetadata({
    title: `${filter.title} homologados World Aquatics`,
    description:
      'Jammers para hombre y knee suits para mujer TAUPOC, homologados por World Aquatics. Envío a toda Latinoamérica.',
    path: '/catalogo',
    clPath: '/catalogo',
    // Las vistas filtradas no se indexan: la canónica es el catálogo completo.
    noIndex: Boolean(filter.slug),
  });
}

export default async function IntlCatalog({ searchParams }: { searchParams: SearchParams }) {
  const filter = filterFor((await searchParams).genero);
  const cards = await getIntlCards(filter.gender ? { gender: filter.gender } : {});

  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[clamp(40px,6vw,96px)] leading-[0.95]">{filter.title}</h1>
      <nav aria-label="Filtrar" className="mb-12 mt-8 flex gap-6 text-[15px]">
        {FILTERS.map((f) => (
          <Link
            key={f.slug}
            href={f.slug ? `/catalogo?genero=${f.slug}` : '/catalogo'}
            aria-current={f.slug === filter.slug ? 'page' : undefined}
            className={cn(
              'underline-offset-[6px]',
              f.slug === filter.slug ? 'text-graphite underline' : 'text-graphite-soft hover:text-graphite',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {cards.length > 0 ? (
        <ProductGrid cards={cards} priority={2} />
      ) : (
        <p className="text-[17px] text-graphite-soft">No hay productos disponibles por ahora.</p>
      )}
    </section>
  );
}
