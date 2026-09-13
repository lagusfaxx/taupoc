'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Price } from '@/components/ui/Price';
import { RatingSummary } from '@/components/ui/Stars';
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
  /** Sello de gama, solo en la línea superior. Ej. "Serie Élite". */
  tierLabel?: string | null;
  /** Escalón de la línea: 1 es la de entrada, los mayores son superiores. */
  tier?: number;
  /** Los datos que separan esta línea de la otra. Ej. "150 g · 2,1%…". */
  lineClaim?: string | null;
  rating: { average: number; count: number };
  /**
   * Tarjeta de un color concreto: la grilla muestra ese color, lo nombra bajo
   * el título y enlaza a la ficha de ese color.
   */
  colorSlug?: string | null;
}

export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const fixed = product.colorSlug
    ? (product.colors.find((c) => c.slug === product.colorSlug) ?? null)
    : null;

  const [activeId, setActiveId] = useState(fixed?.id ?? product.colors[0]?.id ?? null);

  const active = useMemo(
    () => (fixed ?? product.colors.find((c) => c.id === activeId) ?? product.colors[0] ?? null),
    [fixed, activeId, product.colors],
  );

  // Tarjeta fijada a un color: va derecho a la ficha de ese color. Tarjeta de
  // modelo con varios colores: lleva el elegido en la muestra, y la ficha
  // decide si lo preselecciona o redirige a su propia página.
  const href = fixed
    ? `/producto/${product.slug}-${fixed.slug}`
    : active && product.colors.length > 1
      ? `/producto/${product.slug}?color=${active.slug}`
      : `/producto/${product.slug}`;
  const image = active?.imageUrl ?? product.fallbackImage;
  // Con la tarjeta fijada a un color manda el stock de ese color, no el del modelo.
  const unavailable = product.comingSoon || (fixed ? fixed.stock === 0 : product.totalStock === 0);

  // Las dos líneas comparten fotografía, así que la tarjeta de la línea
  // superior se distingue por el marco y el sello: sin eso, en la grilla son
  // la misma foto con otro precio.
  const elite = (product.tier ?? 0) > 1;

  return (
    <article className="group flex flex-col" style={{ ['--accent' as string]: product.accentHex }}>
      <Link
        href={href}
        className={cn(
          'relative block overflow-hidden border bg-ink-800',
          elite ? 'accent-border' : 'border-line',
        )}
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

          {/* El sello de gama: en una grilla donde dos trajes se ven iguales,
              es lo único que anticipa por qué uno cuesta más. */}
          {product.tierLabel ? (
            <span className="absolute left-0 top-3 accent-bg px-2.5 py-1.5 font-display text-[9.5px] font-bold uppercase tracking-mega">
              {product.tierLabel}
            </span>
          ) : null}

          {unavailable ? (
            <span className="absolute bottom-3 left-3 bg-ink/85 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-chalk-dim backdrop-blur">
              {product.comingSoon ? 'Próximamente' : 'Agotado'}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-3.5">
        <h3 className="font-display text-[16px] leading-tight tracking-tight text-chalk">
          <Link href={href} className="hover:accent-text">
            {product.name}
          </Link>
        </h3>

        {/* Los datos de la línea, bajo el título: con la misma foto en las dos
            líneas, es lo que explica la diferencia de precio en la grilla. */}
        {product.lineClaim ? (
          <p
            className={cn(
              'mt-1.5 text-[12px] leading-snug',
              elite ? 'accent-text' : 'text-chalk-faint',
            )}
          >
            {product.lineClaim}
          </p>
        ) : null}

        {fixed ? (
          <p className="mt-1.5 flex items-center gap-2 text-[13px] text-chalk-dim">
            <span
              aria-hidden
              className="inline-block h-3 w-3 border border-line-bright"
              style={{ background: fixed.hex }}
            />
            {colorLabel(fixed)}
          </p>
        ) : null}

        {!fixed && product.colors.length > 1 ? (
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

        {product.rating.count > 0 ? (
          <RatingSummary
            average={product.rating.average}
            count={product.rating.count}
            className="mt-2.5"
          />
        ) : null}

        <div className="mt-auto pt-3.5">
          <Price amount={product.basePrice} size="sm" />
        </div>
      </div>
    </article>
  );
}
