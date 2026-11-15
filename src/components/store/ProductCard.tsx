'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Price } from '@/components/ui/Price';
import { cn } from '@/lib/utils';
import { colorLabel } from '@/lib/colors';
import { formatCLP } from '@/lib/money';
import { useStorePrefs } from './StorePrefs';

export interface ProductCardColor {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  hex: string;
  imageUrl: string | null;
  stock: number;
  /** Tallas con unidades disponibles, en orden. */
  sizes?: string[];
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

export function ProductCard({
  product,
  priority,
  sizes,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Tallas filtradas en el catálogo: la ficha abre con la primera disponible ya elegida. */
  sizes?: string[];
}) {
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
  const query = new URLSearchParams();
  if (!fixed && active && product.colors.length > 1) query.set('color', active.slug);
  if (sizes?.length) query.set('talla', sizes.join(','));
  const qs = query.toString();
  const href = `/producto/${product.slug}${fixed ? `-${fixed.slug}` : ''}${qs ? `?${qs}` : ''}`;
  const image = active?.imageUrl ?? product.fallbackImage;
  // Con la tarjeta fijada a un color manda el stock de ese color, no el del modelo.
  const unavailable = product.comingSoon || (fixed ? fixed.stock === 0 : product.totalStock === 0);

  // Las dos líneas comparten fotografía: la superior lleva el sello y el
  // filete de acento fijo.
  const elite = (product.tier ?? 0) > 1;

  const { transferDiscount } = useStorePrefs();
  const transferPrice =
    transferDiscount > 0 ? Math.round(product.basePrice * (1 - transferDiscount / 100)) : null;

  // Tallas del color a la vista; en una tarjeta de modelo, las del color activo.
  const sizeList = active?.sizes ?? [];
  const stockLeft = fixed ? fixed.stock : (active?.stock ?? product.totalStock);
  const lastUnits = !unavailable && stockLeft > 0 && stockLeft <= 2;

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
        className="relative block overflow-hidden rounded-[6px] bg-[#EFEFED]"
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

          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {product.tierLabel ? (
              <span className="rounded-[3px] bg-ink px-2 py-1 font-display text-[9px] font-semibold uppercase tracking-mega accent-text">
                {product.tierLabel}
              </span>
            ) : null}
            {lastUnits ? (
              <span className="rounded-[3px] bg-ink px-2 py-1 font-display text-[9px] font-semibold uppercase tracking-widest text-chalk">
                {stockLeft === 1 ? 'Última unidad' : 'Últimas unidades'}
              </span>
            ) : null}
          </div>

          {unavailable ? (
            <span className="absolute right-2.5 top-2.5 rounded-[3px] bg-ink/90 px-2 py-1 font-display text-[9px] font-semibold uppercase tracking-mega text-chalk-dim">
              {product.comingSoon ? 'Próximamente' : 'Agotado'}
            </span>
          ) : null}

          {/* Tallas disponibles: entran al pasar el cursor, sobre la foto. */}
          {!unavailable && sizeList.length > 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-full items-center gap-1.5 bg-ink/92 px-3 py-2.5 transition-transform duration-300 ease-tech group-hover:translate-y-0 lg:flex"
            >
              <span className="mr-1 font-display text-[9px] font-semibold uppercase tracking-widest text-chalk-faint">
                Tallas
              </span>
              {sizeList.slice(0, 8).map((size) => (
                <span
                  key={size}
                  className="min-w-[26px] rounded-[3px] border border-line-bright px-1 py-0.5 text-center font-display text-[11px] font-semibold text-chalk"
                >
                  {size}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Filete de acento que entra al pasar el cursor. */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-0 bottom-0 h-[2px] origin-left accent-bg transition-transform duration-500 ease-tech',
            elite ? 'scale-x-100' : 'hidden',
          )}
        />
      </Link>

      <div className="flex flex-1 flex-col pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[13.5px] font-semibold uppercase leading-tight tracking-wide text-chalk">
            <Link href={href} prefetch={false} className="transition-colors hover:accent-text">
              {product.name}
            </Link>
          </h3>
          {product.rating.count > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[12px] text-chalk-dim"
              aria-label={`${product.rating.average.toFixed(1)} de 5, ${product.rating.count} reseñas`}
            >
              <span className="accent-text" aria-hidden>★</span>
              {product.rating.average.toFixed(1).replace('.', ',')}
              <span className="text-chalk-faint">({product.rating.count})</span>
            </span>
          ) : null}
        </div>

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

        {/* En pantallas táctiles no hay cursor: las tallas van escritas. */}
        {!unavailable && sizeList.length > 0 ? (
          <p className="mt-1.5 text-[12px] text-chalk-faint lg:hidden">
            {sizeList.length === 1 ? 'Talla' : 'Tallas'} {sizeList.slice(0, 6).join(' · ')}
            {sizeList.length > 6 ? ' …' : ''}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
          <Price amount={product.basePrice} size="sm" className="text-[16px]" />
          {transferPrice != null && !product.comingSoon ? (
            <p className="mt-0.5 text-[12px] text-chalk-dim">
              <span className="font-semibold text-chalk">{formatCLP(transferPrice)}</span> con transferencia
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
