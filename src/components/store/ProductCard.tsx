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
  /** Sello de gama, solo en la línea superior. Ej. "Serie Élite". */
  tierLabel?: string | null;
  /** Escalón de la línea: 1 es la de entrada, los mayores son superiores. */
  tier?: number;
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

  // Las dos líneas comparten fotografía: la superior lleva el sello y el
  // filete de acento fijo.
  const elite = (product.tier ?? 0) > 1;

  return (
    <article className="group flex flex-col" style={{ ['--accent' as string]: product.accentHex }}>
      <Link
        href={href}
        // La grilla trae veinte tarjetas y cada ficha es una página dinámica:
        // con el prefetch de Next, mirar el catálogo dispara veinte renders
        // completos en el servidor y el clic de verdad queda haciendo cola
        // detrás. La ficha ya tiene su propio esqueleto de carga, así que se
        // abre igual de rápido sin adelantarla.
        prefetch={false}
        className="relative block overflow-hidden bg-[#EFEFED]"
      >
        <div className="relative aspect-[4/5]">
          {image ? (
            // Las fotos vienen sobre blanco: multiply funde ese blanco con el
            // gris del cuadro y el traje queda sobre un fondo parejo.
            <Image
              src={image}
              alt={`${product.name} — ${active ? colorLabel(active) : ''}`}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 24vw"
              priority={priority}
              className="object-contain p-[7%] mix-blend-multiply transition-transform duration-700 ease-tech group-hover:scale-[1.04]"
            />
          ) : null}

          {product.tierLabel ? (
            <span className="absolute left-3 top-3 bg-ink px-2 py-1 font-display text-[9px] font-semibold uppercase tracking-mega accent-text">
              {product.tierLabel}
            </span>
          ) : null}

          {unavailable ? (
            <span className="absolute right-3 top-3 bg-ink/90 px-2 py-1 font-display text-[9px] font-semibold uppercase tracking-mega text-chalk-dim">
              {product.comingSoon ? 'Próximamente' : 'Agotado'}
            </span>
          ) : null}
        </div>

        {/* Filete de acento que entra al pasar el cursor. */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-0 bottom-0 h-[2px] origin-left accent-bg transition-transform duration-500 ease-tech',
            elite ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
          )}
        />
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        <h3 className="font-display text-[13px] font-semibold uppercase leading-tight tracking-wide text-chalk">
          <Link href={href} prefetch={false} className="transition-colors hover:accent-text">
            {product.name}
          </Link>
        </h3>

        <div className="mt-2 flex min-h-[20px] items-center">
          {!fixed && product.colors.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
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
                    'relative h-3.5 w-3.5 rounded-full ring-1 ring-offset-2 ring-offset-ink transition-all duration-150',
                    color.id === active?.id ? 'ring-chalk' : 'ring-transparent hover:ring-line-bright',
                  )}
                  style={{ background: color.hex }}
                >
                  {color.stock === 0 ? (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                      <span className="h-px w-[130%] rotate-45 bg-chalk-faint" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : active ? (
            <p className="flex items-center gap-2 text-[12.5px] text-chalk-faint">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-line-bright"
                style={{ background: active.hex }}
              />
              {colorLabel(active)}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex items-baseline justify-between gap-3 pt-3">
          <Price amount={product.basePrice} size="sm" />
          {product.rating.count > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[12px] text-chalk-faint"
              aria-label={`${product.rating.average.toFixed(1)} de 5, ${product.rating.count} reseñas`}
            >
              <span className="accent-text" aria-hidden>★</span>
              {product.rating.average.toFixed(1).replace('.', ',')}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
