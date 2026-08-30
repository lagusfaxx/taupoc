'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Price } from '@/components/ui/Price';
import { cn } from '@/lib/utils';
import { colorLabel } from '@/lib/colors';

export interface ProductCardColor {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  hex: string;
  imageUrl: string | null;
  /** Stock sumado de todas las tallas de este color. */
  stock: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  modelCode: string;
  subtitle: string | null;
  lineName: string | null;
  genderLabel: string;
  approvalCode: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  comingSoon: boolean;
  totalStock: number;
  sizesInStock: number;
  totalSizes: number;
  colors: ProductCardColor[];
  fallbackImage: string | null;
  accentHex: string;
}

export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const [activeId, setActiveId] = useState(product.colors[0]?.id ?? null);

  const active = useMemo(
    () => product.colors.find((c) => c.id === activeId) ?? product.colors[0] ?? null,
    [activeId, product.colors],
  );

  const image = active?.imageUrl ?? product.fallbackImage;
  const accent = active ? active.hex : product.accentHex;
  const lowStock = !product.comingSoon && product.totalStock > 0 && product.totalStock <= 6;

  return (
    <article
      className="group relative flex flex-col"
      style={{ ['--accent' as string]: product.accentHex }}
    >
      <Link
        href={`/producto/${product.slug}`}
        className="relative block overflow-hidden border border-line bg-ink-800"
        aria-label={`${product.name} — ${product.modelCode}`}
      >
        <div className="relative aspect-[4/5]">
          {image ? (
            <Image
              src={image}
              alt={`${product.name} — ${active ? colorLabel(active) : ''}`}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 24vw"
              priority={priority}
              className="object-cover transition-transform duration-700 ease-tech group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-ink-700" />
          )}

          {/* Degradado inferior para que las etiquetas siempre sean legibles. */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/85 to-transparent" />

          <div className="absolute left-0 top-0 flex flex-col items-start gap-1.5 p-3">
            {product.comingSoon ? (
              <span className="bg-ink/90 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-chalk backdrop-blur">
                Próximamente
              </span>
            ) : product.totalStock === 0 ? (
              <span className="bg-ink/90 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-chalk-faint backdrop-blur">
                Agotado
              </span>
            ) : lowStock ? (
              <span className="bg-signal-warn/90 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-ink">
                Últimas unidades
              </span>
            ) : null}

            {product.approvalCode ? (
              <span
                className="flex items-center gap-1.5 bg-ink/90 px-2 py-1 font-mono text-[10px] font-medium tracking-wide text-chalk backdrop-blur"
                title={`Homologación World Aquatics ${product.approvalCode}`}
              >
                <span className="h-1.5 w-1.5" style={{ background: accent }} aria-hidden />
                {product.approvalCode}
              </span>
            ) : null}
          </div>

          <span
            className="absolute bottom-0 left-0 h-[3px] w-0 transition-all duration-500 ease-tech group-hover:w-full"
            style={{ background: accent }}
            aria-hidden
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-center gap-2">
          {product.lineName ? (
            <span className="font-display text-[10px] font-semibold uppercase tracking-mega text-chalk-faint">
              {product.lineName}
            </span>
          ) : null}
          <span className="font-display text-[10px] uppercase tracking-widest text-chalk-faint/70">
            {product.genderLabel}
          </span>
        </div>

        <h3 className="mt-1.5 font-display text-[17px] leading-tight tracking-tight text-chalk">
          <Link href={`/producto/${product.slug}`} className="hover:accent-text">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1 text-[13px] text-chalk-faint">
          {product.modelCode}
          {product.comingSoon
            ? ' · Próximo lanzamiento'
            : ` · ${product.sizesInStock} de ${product.totalSizes} tallas disponibles`}
        </p>

        {product.colors.length > 1 ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            {product.colors.slice(0, 9).map((color) => (
              <button
                key={color.id}
                type="button"
                onMouseEnter={() => setActiveId(color.id)}
                onFocus={() => setActiveId(color.id)}
                onClick={() => setActiveId(color.id)}
                aria-label={`Ver en ${colorLabel(color)}`}
                aria-pressed={color.id === active?.id}
                title={colorLabel(color)}
                className={cn(
                  'relative h-5 w-5 border transition-all duration-150',
                  color.id === active?.id ? 'border-chalk' : 'border-line-bright hover:border-chalk-faint',
                )}
                style={{ background: color.hex }}
              >
                {color.stock === 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                    <span className="h-px w-[135%] rotate-45 bg-ink shadow-[0_0_0_1px_rgba(244,246,248,0.6)]" />
                  </span>
                ) : null}
              </button>
            ))}
            {product.colors.length > 9 ? (
              <span className="ml-0.5 font-display text-[11px] tracking-wide text-chalk-faint">
                +{product.colors.length - 9}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-4">
          <Price amount={product.basePrice} compareAt={product.compareAtPrice} size="sm" />
        </div>
      </div>
    </article>
  );
}
