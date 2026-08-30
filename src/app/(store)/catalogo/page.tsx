import type { Metadata } from 'next';
import type { Gender } from '@prisma/client';
import { getCatalog, getCatalogFacets } from '@/lib/catalog';
import { buildMetadata, jsonLd, absoluteUrl } from '@/lib/seo';
import { ProductCard } from '@/components/store/ProductCard';
import { CatalogShell } from '@/components/store/CatalogFilters';
import { Empty } from '@/components/ui/Empty';
import { ButtonLink } from '@/components/ui/Button';
import { IconBox } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function list(v: string | string[] | undefined): string[] | undefined {
  const raw = one(v);
  if (!raw) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const gender = one(params.genero);
  const line = one(params.linea);

  const parts = ['Catálogo de competición'];
  if (gender === 'MALE') parts[0] = 'Jammers de competición hombre';
  if (gender === 'FEMALE') parts[0] = 'Knee suits de competición mujer';
  if (line) parts.push(`línea ${line.toUpperCase()}`);

  return buildMetadata({
    title: parts.join(' — '),
    description:
      'Trajes de competición TAUPOC homologados por World Aquatics. Tallas 20 a 36 con stock real en Chile, ' +
      'despacho a todo el país y retiro sin costo en Santiago.',
    path: '/catalogo',
    // Las combinaciones de filtros no deben indexarse por separado.
    noIndex: Object.keys(params).length > 0,
  });
}

const SORT_VALUES = ['destacados', 'precio-asc', 'precio-desc', 'nuevos', 'nombre'] as const;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const genderRaw = one(params.genero);
  const gender = genderRaw === 'MALE' || genderRaw === 'FEMALE' ? (genderRaw as Gender) : undefined;
  const sortRaw = one(params.orden);
  const sort = SORT_VALUES.includes(sortRaw as (typeof SORT_VALUES)[number])
    ? (sortRaw as (typeof SORT_VALUES)[number])
    : 'destacados';

  const [products, facets] = await Promise.all([
    getCatalog({
      gender,
      lineSlug: one(params.linea),
      sizes: list(params.tallas),
      colors: list(params.colores),
      minPrice: one(params.precio_min) ? Number(one(params.precio_min)) : undefined,
      maxPrice: one(params.precio_max) ? Number(one(params.precio_max)) : undefined,
      inStockOnly: one(params.stock) === '1',
      query: one(params.q),
      sort,
    }),
    getCatalogFacets(),
  ]);

  const heading =
    gender === 'MALE' ? 'Competición hombre'
    : gender === 'FEMALE' ? 'Competición mujer'
    : one(params.q) ? `Resultados para "${one(params.q)}"`
    : 'Catálogo de competición';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/producto/${p.slug}`),
      name: p.name,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />

      <div className="border-b border-line bg-ink-900">
        <div className="container py-12 lg:py-16">
          <p className="eyebrow-accent mb-3">TAUPOC Chile</p>
          <h1 className="text-balance font-display text-[32px] leading-none tracking-tightest text-chalk sm:text-[44px]">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed text-chalk-dim">
            Cada combinación de talla y color es un SKU con stock propio. Si aparece disponible,
            está en bodega en Chile y sale despachado el mismo día hábil.
          </p>
        </div>
      </div>

      <div className="container py-10 lg:py-14">
        <CatalogShell facets={facets} resultCount={products.length}>
          {products.length === 0 ? (
            <Empty
              icon={<IconBox className="h-9 w-9" />}
              title="No encontramos productos con esos filtros"
              description="Prueba quitando algún filtro de talla o color, o revisa el catálogo completo."
              action={<ButtonLink href="/catalogo" variant="outline">Ver todo el catálogo</ButtonLink>}
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-6 xl:gap-x-8">
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} priority={i < 3} />
              ))}
            </div>
          )}
        </CatalogShell>
      </div>
    </>
  );
}
