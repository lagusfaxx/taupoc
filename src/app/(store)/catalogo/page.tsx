import type { Metadata } from 'next';
import type { Gender } from '@prisma/client';
import {
  colorPagePath,
  getCatalog,
  getCatalogFacets,
  getLineComparison,
  splitCardsByColor,
} from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { buildMetadata, jsonLd, absoluteUrl } from '@/lib/seo';
import { ProductCard } from '@/components/store/ProductCard';
import { LineCompareTeaser } from '@/components/store/LineCompareTeaser';
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
      'Trajes de competición TAUPOC homologados por World Aquatics. Despacho a todo el país ' +
      'y retiro sin costo en Santiago.',
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

  const [found, facets, settings, comparacion] = await Promise.all([
    getCatalog({
      gender,
      lineSlug: one(params.linea),
      categorySlug: one(params.categoria),
      sizes: list(params.tallas),
      colors: list(params.colores),
      minPrice: one(params.precio_min) ? Number(one(params.precio_min)) : undefined,
      maxPrice: one(params.precio_max) ? Number(one(params.precio_max)) : undefined,
      inStockOnly: one(params.stock) === '1',
      query: one(params.q),
      sort,
    }),
    getCatalogFacets(),
    getSettings(),
    getLineComparison(),
  ]);

  // Con el ajuste activo cada color ocupa su propio lugar en la grilla.
  const products = settings.catalogSplitByColor ? splitCardsByColor(found) : found;

  const heading =
    gender === 'MALE' ? 'Competición hombre'
    : gender === 'FEMALE' ? 'Competición mujer'
    : one(params.q) ? `Resultados para "${one(params.q)}"`
    : 'Catálogo de competición';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    // Una entrada por ficha publicada. Con la división activa cada color tiene
    // su propia URL, así que no se repite ninguna.
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => {
      const color = p.colorSlug ? p.colors.find((c) => c.slug === p.colorSlug) : null;
      return {
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(
          color ? colorPagePath(p.slug, color.slug) : `/producto/${p.slug}`,
        ),
        name: color ? `${p.name} — ${color.name}` : p.name,
      };
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />

      <div className="border-b border-line">
        <div className="container py-7">
          <h1 className="font-display text-[24px] leading-none tracking-tight text-chalk sm:text-[30px]">
            {heading}
          </h1>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
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

      {/* Solo cuando la grilla mezcla las dos líneas: filtrando por una, la
          comparación ya no es la pregunta que trae al visitante. */}
      {one(params.linea) ? null : <LineCompareTeaser columns={comparacion} />}
    </>
  );
}
