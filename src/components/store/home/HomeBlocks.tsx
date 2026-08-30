import Link from 'next/link';
import { getFeatured } from '@/lib/catalog';
import type { HomeBlockData } from '@/lib/home';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/store/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { IconArrow } from '@/components/ui/Icons';
import { BlockMedia } from './BlockMedia';

/** Alto del bloque según lo elegido en el panel. */
const HEIGHTS: Record<string, string> = {
  AUTO: 'min-h-0',
  COMPACTA: 'min-h-[240px] lg:min-h-[300px]',
  MEDIA: 'min-h-[380px] lg:min-h-[480px]',
  ALTA: 'min-h-[520px] lg:min-h-[660px]',
  PANTALLA: 'min-h-[86svh]',
};

const ALIGN: Record<string, string> = {
  IZQUIERDA: 'items-start text-left',
  CENTRO: 'items-center text-center',
  DERECHA: 'items-end text-right',
};

const BACKGROUNDS: Record<string, string> = {
  ink: 'bg-ink',
  oscuro: 'bg-ink-900',
  carbon: 'bg-ink-800',
  acento: 'accent-bg text-ink',
};

const COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
};

export function HomeBlocks({ blocks }: { blocks: HomeBlockData[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={block.id} block={block} first={index === 0} />
      ))}
    </>
  );
}

function Block({ block, first }: { block: HomeBlockData; first: boolean }) {
  switch (block.type) {
    case 'BANNER':
    case 'MEDIA':
      return <Banner block={block} priority={first} first={first} />;
    case 'PRODUCTOS':
      return <Products block={block} priority={first} first={first} />;
    case 'CATEGORIAS':
      return <Categories block={block} first={first} />;
    case 'TEXTO':
      return <Texto block={block} first={first} />;
    default:
      return null;
  }
}

/** Encabezado corto de una sección; se omite entero si no tiene título. */
function Heading({ block }: { block: HomeBlockData }) {
  if (!block.title && !block.eyebrow) return null;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {block.eyebrow ? (
          <p className="font-display text-[10px] font-semibold uppercase tracking-mega text-chalk-faint">
            {block.eyebrow}
          </p>
        ) : null}
        {block.title ? (
          <h2 className="mt-1.5 font-display text-[22px] leading-none tracking-tight text-chalk">
            {block.title}
          </h2>
        ) : null}
        {block.subtitle ? (
          <p className="mt-2.5 max-w-xl text-[14.5px] leading-relaxed text-chalk-dim">
            {block.subtitle}
          </p>
        ) : null}
      </div>

      {block.ctaHref && block.ctaLabel ? (
        <Link
          href={block.ctaHref}
          className="group inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-text"
        >
          {block.ctaLabel}
          <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}

/** El primer bloque no lleva borde arriba: el encabezado ya trae el suyo. */
const borde = (first: boolean) => (first ? '' : 'border-t border-line');

function Banner({
  block,
  priority,
  first,
}: {
  block: HomeBlockData;
  priority: boolean;
  first: boolean;
}) {
  const media = block.imageUrl || block.videoUrl;
  const texto = block.title || block.subtitle || block.eyebrow || block.ctaLabel;

  return (
    <section className={cn('relative', borde(first), !media && BACKGROUNDS[block.background])}>
      {media ? (
        <div className="absolute inset-0 overflow-hidden">
          <BlockMedia
            imageUrl={block.imageUrl}
            imageMobileUrl={block.imageMobileUrl}
            videoUrl={block.videoUrl}
            posterUrl={block.posterUrl}
            alt={block.title ?? ''}
            fit={block.fit}
            priority={priority}
          />
          {/* El oscurecido es lo que hace legible el texto sobre la foto. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-ink"
            style={{ opacity: Math.min(90, Math.max(0, block.overlay)) / 100 }}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'container relative flex flex-col justify-center py-14 lg:py-16',
          HEIGHTS[block.height] ?? HEIGHTS.MEDIA,
          ALIGN[block.align] ?? ALIGN.IZQUIERDA,
        )}
      >
        {texto ? (
          <div className="max-w-xl">
            {block.eyebrow ? (
              <p className="font-display text-[10px] font-semibold uppercase tracking-mega text-chalk-faint">
                {block.eyebrow}
              </p>
            ) : null}
            {block.title ? (
              <h2 className="mt-3 text-[32px] leading-[0.95] text-chalk lg:text-[46px]">
                {block.title}
              </h2>
            ) : null}
            {block.subtitle ? (
              <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">{block.subtitle}</p>
            ) : null}

            {block.ctaLabel && block.ctaHref ? (
              <div
                className={cn(
                  'mt-7 flex flex-wrap gap-3',
                  block.align === 'CENTRO' && 'justify-center',
                  block.align === 'DERECHA' && 'justify-end',
                )}
              >
                <ButtonLink href={block.ctaHref} size="lg">
                  {block.ctaLabel}
                </ButtonLink>
                {block.ctaAltLabel && block.ctaAltHref ? (
                  <ButtonLink href={block.ctaAltHref} size="lg" variant="outline">
                    {block.ctaAltLabel}
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

async function Products({
  block,
  priority,
  first,
}: {
  block: HomeBlockData;
  priority: boolean;
  first: boolean;
}) {
  // Sin selección manual la franja muestra los destacados del catálogo.
  const products =
    block.products.length > 0
      ? block.products
      : await getFeatured(Math.max(2, Math.min(8, block.columns)));
  if (products.length === 0) return null;

  return (
    <section className={cn(borde(first), BACKGROUNDS[block.background])}>
      <div className="container py-10 lg:py-12">
        <Heading block={block} />
        <div className={cn('grid gap-x-4 gap-y-10 lg:gap-x-6', COLUMNS[block.columns] ?? COLUMNS[4])}>
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={priority && i < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Categories({ block, first }: { block: HomeBlockData; first: boolean }) {
  if (block.cards.length === 0) return null;

  return (
    <section className={cn(borde(first), BACKGROUNDS[block.background])}>
      <div className="container py-10 lg:py-12">
        <Heading block={block} />
        <div className={cn('grid gap-3 lg:gap-4', COLUMNS[block.columns] ?? COLUMNS[4])}>
          {block.cards.map((card) => (
            <Link
              key={card.id}
              href={card.href || '/catalogo'}
              className="group relative block overflow-hidden border border-line bg-ink-800"
            >
              <div className="relative aspect-[3/4]">
                <BlockMedia
                  imageUrl={card.imageUrl}
                  videoUrl={card.videoUrl}
                  alt={card.label}
                  fit="cover"
                  className="transition-transform duration-700 ease-tech group-hover:scale-[1.05]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
              </div>

              <span className="absolute inset-x-0 bottom-0 p-4">
                <span className="block font-display text-[20px] leading-none tracking-tight text-chalk lg:text-[24px]">
                  {card.label}
                </span>
                {card.caption ? (
                  <span className="mt-1.5 block text-[13px] text-chalk-dim">{card.caption}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Texto({ block, first }: { block: HomeBlockData; first: boolean }) {
  return (
    <section className={cn(borde(first), BACKGROUNDS[block.background])}>
      <div className="container flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-14">
        <div>
          {block.eyebrow ? (
            <p className="font-display text-[10px] font-semibold uppercase tracking-mega text-chalk-faint">
              {block.eyebrow}
            </p>
          ) : null}
          {block.title ? (
            <h2 className="mt-1.5 font-display text-[22px] leading-none tracking-tight text-chalk">
              {block.title}
            </h2>
          ) : null}
          {block.body ? (
            <p className="mt-2.5 max-w-xl whitespace-pre-line text-[14.5px] leading-relaxed text-chalk-dim">
              {block.body}
            </p>
          ) : null}
        </div>

        {block.ctaLabel && block.ctaHref ? (
          <ButtonLink href={block.ctaHref} size="lg" className="shrink-0">
            {block.ctaLabel}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
