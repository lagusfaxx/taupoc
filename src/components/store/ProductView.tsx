'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { addToCart, type CartActionState } from '@/actions/cart';
import { formatCLP, installment } from '@/lib/money';
import { cn, readableOn } from '@/lib/utils';
import { Price } from '@/components/ui/Price';
import { ProductGallery, type GalleryImage } from './ProductGallery';
import { SizeChart, type SizeChartRowData } from './SizeChart';
import { IconCheck, IconExternal, IconShield, IconTruck } from '@/components/ui/Icons';

export interface ViewVariant {
  id: string;
  size: string;
  sku: string;
  available: number;
  price: number;
  lowStock: boolean;
}

export interface ViewColor {
  id: string;
  name: string;
  slug: string;
  hex: string;
  accentHex: string;
  images: GalleryImage[];
  variants: ViewVariant[];
}

export interface ProductViewData {
  id: string;
  slug: string;
  name: string;
  modelCode: string;
  subtitle: string | null;
  lineName: string | null;
  genderLabel: string;
  gender: 'MALE' | 'FEMALE' | 'UNISEX';
  basePrice: number;
  compareAtPrice: number | null;
  approvalCode: string | null;
  approvalBody: string;
  approvalYear: number | null;
  approvalVerifyUrl: string | null;
  comingSoon: boolean;
  fitNotes: string | null;
  fitOffset: number;
  colors: ViewColor[];
  sizeChart: SizeChartRowData[];
  fallbackImages: GalleryImage[];
  installmentsMax: number;
  freeShippingOver: number | null;
}

function AddButton({ disabled, comingSoon }: { disabled: boolean; comingSoon: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending || comingSoon}
      className={cn(
        'h-14 w-full accent-bg font-display text-[13px] font-bold uppercase tracking-widest',
        'transition-all duration-200 ease-tech clip-notch-sm',
        'hover:brightness-110 active:brightness-95',
        'disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-chalk-faint',
      )}
    >
      {comingSoon ? 'Próximamente' : pending ? 'Agregando…' : disabled ? 'Selecciona una talla' : 'Agregar al carrito'}
    </button>
  );
}

export function ProductView({ product }: { product: ProductViewData }) {
  const router = useRouter();
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? '');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [state, action] = useActionState<CartActionState | null, FormData>(addToCart, null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const color = useMemo(
    () => product.colors.find((c) => c.id === colorId) ?? product.colors[0],
    [colorId, product.colors],
  );

  const variant = useMemo(
    () => color?.variants.find((v) => v.id === variantId) ?? null,
    [color, variantId],
  );

  const accent = color?.accentHex ?? '#00E0B8';
  const images = color?.images.length ? color.images : product.fallbackImages;
  const price = variant?.price ?? product.basePrice;

  const colorStock = color?.variants.reduce((s, v) => s + v.available, 0) ?? 0;

  // Al cambiar de color se conserva la talla si sigue existiendo con stock.
  useEffect(() => {
    if (!color) return;
    const current = color.variants.find((v) => v.id === variantId);
    if (current) return;
    const previousSize = product.colors
      .flatMap((c) => c.variants)
      .find((v) => v.id === variantId)?.size;
    const match = previousSize
      ? color.variants.find((v) => v.size === previousSize && v.available > 0)
      : null;
    setVariantId(match?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorId]);

  // Tras agregar al carrito, refrescamos para actualizar el badge del header.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function selectSize(size: string) {
    const match = color?.variants.find((v) => v.size === size);
    if (match && match.available > 0) setVariantId(match.id);
  }

  return (
    <div
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14 xl:gap-20"
      style={{ ['--accent' as string]: accent, ['--accent-contrast' as string]: readableOn(accent) }}
    >
      <div className="lg:sticky lg:top-24 lg:self-start">
        <ProductGallery images={images} colorName={color?.name ?? ''} productName={product.name} />
      </div>

      <div>
        {/* Encabezado */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {product.lineName ? (
            <span className="eyebrow-accent">{product.lineName}</span>
          ) : null}
          <span className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
            {product.genderLabel} · {product.modelCode}
          </span>
        </div>

        <h1 className="mt-3 text-balance font-display text-[32px] leading-[1.02] tracking-tightest text-chalk sm:text-[42px]">
          {product.name}
        </h1>
        {product.subtitle ? (
          <p className="mt-2.5 text-[15px] text-chalk-dim">{product.subtitle}</p>
        ) : null}

        {/* Homologación: el bloque más importante de la página */}
        {product.approvalCode ? (
          <div className="mt-6 border accent-border bg-ink-900">
            <div className="flex items-start gap-4 p-4 sm:p-5">
              <IconShield className="mt-0.5 h-7 w-7 shrink-0 accent-text" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] font-semibold uppercase tracking-mega accent-text">
                  Homologado {product.approvalBody}
                  {product.approvalYear ? ` · ${product.approvalYear}` : ''}
                </p>
                <p className="mt-2 break-all font-mono text-[22px] font-medium leading-none tracking-wider text-chalk sm:text-[26px]">
                  {product.approvalCode}
                </p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-faint">
                  Apto para competencia oficial en todas las categorías. Tu entrenador puede verificar
                  este código en el registro público de World Aquatics.
                </p>
                {product.approvalVerifyUrl ? (
                  <a
                    href={product.approvalVerifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest accent-text underline underline-offset-4"
                  >
                    Verificar en el registro oficial
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Precio */}
        <div className="mt-7">
          <Price amount={price} compareAt={product.compareAtPrice} size="lg" />
          {product.installmentsMax > 1 ? (
            <p className="mt-2 text-[13.5px] text-chalk-dim">
              Hasta {product.installmentsMax} cuotas de{' '}
              <strong className="text-chalk">{formatCLP(installment(price, product.installmentsMax))}</strong>{' '}
              con Mercado Pago
            </p>
          ) : null}
        </div>

        <form action={action} className="mt-8">
          <input type="hidden" name="variantId" value={variant?.id ?? ''} />
          <input type="hidden" name="quantity" value="1" />

          {/* Selector de color */}
          {product.colors.length > 1 ? (
            <fieldset className="mb-7">
              <legend className="mb-3 flex w-full items-baseline justify-between gap-3">
                <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim">
                  Color
                </span>
                <span className="text-[13px] text-chalk">{color?.name}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => {
                  const stock = c.variants.reduce((s, v) => s + v.available, 0);
                  const selected = c.id === color?.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorId(c.id)}
                      aria-pressed={selected}
                      aria-label={`Color ${c.name}${stock === 0 ? ' (agotado)' : ''}`}
                      title={c.name}
                      className={cn(
                        'relative h-10 w-10 border-2 transition-all duration-150',
                        selected ? 'border-chalk' : 'border-line hover:border-chalk-faint',
                        stock === 0 && 'opacity-40',
                      )}
                      style={{ background: c.hex }}
                    >
                      {stock === 0 ? (
                        <span
                          className="absolute inset-0 flex items-center justify-center"
                          aria-hidden
                        >
                          <span className="h-[1.5px] w-[130%] rotate-45 bg-chalk/70" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {/* Selector de talla — el punto de mayor fricción del rubro */}
          <fieldset>
            <legend className="mb-3 flex w-full items-center justify-between gap-3">
              <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim">
                Talla {variant ? <span className="text-chalk">· {variant.size}</span> : null}
              </span>
              <SizeChart
                rows={product.sizeChart}
                gender={product.gender}
                fitNotes={product.fitNotes}
                fitOffset={product.fitOffset}
                productName={product.name}
                onPickSize={selectSize}
              />
            </legend>

            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {color?.variants.map((v) => {
                const selected = v.id === variant?.id;
                const out = v.available <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={out}
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={selected}
                    aria-label={`Talla ${v.size}${out ? ' agotada' : v.lowStock ? `, últimas ${v.available}` : ''}`}
                    className={cn(
                      'relative flex h-12 items-center justify-center border font-display text-[15px] font-semibold tracking-wide transition-all duration-150',
                      selected
                        ? 'accent-border accent-text bg-ink-800'
                        : out
                          ? 'cursor-not-allowed border-line-soft text-chalk-faint/40'
                          : 'border-line text-chalk hover:border-chalk-faint',
                    )}
                  >
                    {v.size}
                    {out ? (
                      <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 rotate-[-20deg] bg-line-bright" aria-hidden />
                    ) : v.lowStock ? (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 bg-signal-warn" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Estado de stock en vivo */}
            <p ref={liveRef} aria-live="polite" className="mt-3 min-h-[20px] text-[13px]">
              {variant ? (
                variant.lowStock ? (
                  <span className="text-signal-warn">
                    Últimas {variant.available} unidades de la talla {variant.size} en {color?.name}.
                  </span>
                ) : (
                  <span className="text-signal-ok">
                    {variant.available} unidades disponibles · SKU {variant.sku}
                  </span>
                )
              ) : colorStock === 0 ? (
                <span className="text-chalk-faint">
                  Este color está agotado. Prueba con otro o escríbenos para avisarte de la reposición.
                </span>
              ) : (
                <span className="text-chalk-faint">
                  Selecciona tu talla. Recuerda: los trajes de carrera se usan 1 a 2 tallas por debajo.
                </span>
              )}
            </p>
          </fieldset>

          <div className="mt-6 space-y-3">
            <AddButton disabled={!variant} comingSoon={product.comingSoon} />

            {state ? (
              <p
                role="status"
                className={cn(
                  'flex items-start gap-2 border px-3.5 py-3 text-[13.5px]',
                  state.ok
                    ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                    : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
                )}
              >
                {state.ok ? <IconCheck className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                <span className="flex-1">{state.message}</span>
                {state.ok ? (
                  <Link href="/carrito" className="shrink-0 font-semibold underline underline-offset-2">
                    Ir al carrito
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        </form>

        {/* Garantías de compra */}
        <ul className="mt-8 divide-y divide-line border-y border-line">
          <li className="flex items-start gap-3 py-3.5">
            <IconTruck className="mt-0.5 h-5 w-5 shrink-0 text-chalk-faint" />
            <p className="text-[13.5px] leading-relaxed text-chalk-dim">
              Despacho a todo Chile en 1 a 8 días hábiles.
              {product.freeShippingOver
                ? ` Gratis sobre ${formatCLP(product.freeShippingOver)}.`
                : ''}{' '}
              Retiro sin costo en Santiago o entrega en torneo.
            </p>
          </li>
          <li className="flex items-start gap-3 py-3.5">
            <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-chalk-faint" />
            <p className="text-[13.5px] leading-relaxed text-chalk-dim">
              Cambio de talla sin costo dentro de 10 días, con el traje sin uso y con etiqueta.{' '}
              <Link href="/devoluciones" className="underline underline-offset-2 hover:text-chalk">
                Ver política
              </Link>
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}
