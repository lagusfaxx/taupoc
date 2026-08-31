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
  stock: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  modelCode: string;
  basePrice: number;
  comingSoon: boolean;
  totalStock: number;
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
  const unavailable = product.comingSoon || product.totalStock === 0;

  return (
    <article className="group flex flex-col" style={{ ['--accent' as string]: product.accentHex }}>
      <Link
        href={`/producto/${product.slug}`}
        className="relative block overflow-hidden border border-line bg-ink-800"
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

          {unavailable ? (
            <span className="absolute bottom-3 left-3 bg-ink/85 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-chalk-dim backdrop-blur">
              {product.comingSoon ? 'Próximamente' : 'Agotado'}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-3.5">
        <h3 className="font-display text-[16px] leading-tight tracking-tight text-chalk">
          <Link href={`/producto/${product.slug}`} className="hover:accent-text">
            {product.name}
          </Link>
        </h3>

        {product.colors.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {product.colors.map((color) => (
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
          </div>
        ) : null}

        <div className="mt-auto pt-3.5">
          <Price amount={product.basePrice} size="sm" />
        </div>
      </div>
    </article>
  );
}
