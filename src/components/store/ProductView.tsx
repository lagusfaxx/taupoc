'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCart, type CartActionState } from '@/actions/cart';
import { formatCLP, installment } from '@/lib/money';
import { cn, readableOn } from '@/lib/utils';
import { colorLabel } from '@/lib/colors';
import { Price } from '@/components/ui/Price';
import { RatingSummary } from '@/components/ui/Stars';
import { announceCart, flyToCart } from './CartLink';
import { ProductGallery, type GalleryImage } from './ProductGallery';
import { SizeChart, type SizeChartRowData } from './SizeChart';
import { IconCheck, IconExternal, IconShield, IconTruck } from '@/components/ui/Icons';

export interface ViewVariant {
  id: string;
  size: string;
  sku: string;
  available: number;
  price: number;
}

/** A partir de acá la ficha muestra las unidades restantes como urgencia. */
const SHOW_UNITS_LEFT = 3;

export interface ViewColor {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  hex: string;
  accentHex: string;
  stripCode: string | null;
  stripHex: string | null;
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
  rating: { average: number; count: number };
}

function AddButton({
  disabled,
  comingSoon,
  pending,
}: {
  disabled: boolean;
  comingSoon: boolean;
  pending: boolean;
}) {
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

/**
 * Fila de colores con el nombre del colorway y su vivo.
 *
 * Se monta dos veces —una por punto de quiebre— porque en el teléfono tiene
 * que quedar junto a la galería y en el escritorio junto a la talla, y son
 * columnas distintas de la grilla. Solo una está visible a la vez.
 */
function ColorPicker({
  colors,
  activeId,
  onPick,
  className,
}: {
  colors: ViewColor[];
  activeId: string | undefined;
  onPick: (id: string) => void;
  className?: string;
}) {
  if (colors.length <= 1) return null;
  const color = colors.find((c) => c.id === activeId) ?? colors[0];

  return (
    <fieldset className={className}>
      <legend className="mb-3 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim">
          Color
        </span>
        <span className="text-[13px] text-chalk">
          {color?.name}
          {color?.code ? (
            <span className="ml-1.5 font-mono text-[12px] text-chalk-faint">{color.code}</span>
          ) : null}
          {color?.stripCode ? (
            <span className="ml-2 text-chalk-faint">
              · Vivo{' '}
              {color.stripHex ? (
                <span
                  className="mr-1 inline-block h-2.5 w-2.5 translate-y-[1px] border border-line-bright"
                  style={{ background: color.stripHex }}
                  aria-hidden
                />
              ) : null}
              <span className="font-mono text-[12px]">{color.stripCode}</span>
            </span>
          ) : null}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const stock = c.variants.reduce((s, v) => s + v.available, 0);
          const selected = c.id === color?.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              aria-pressed={selected}
              aria-label={`Color ${colorLabel(c)}${stock === 0 ? ' (agotado)' : ''}`}
              title={`${colorLabel(c)}${c.stripCode ? ` · vivo ${c.stripCode}` : ''}`}
              className={cn(
                'relative h-10 w-10 border-2 transition-all duration-150',
                selected ? 'border-chalk' : 'border-line hover:border-chalk-faint',
              )}
              style={{ background: c.hex }}
            >
              {stock === 0 ? (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                  {/* Sin bajar la opacidad: atenuar el swatch falsearía el
                      colorway, y el código del fabricante es parte de la ficha. */}
                  <span className="h-px w-[135%] rotate-45 bg-ink shadow-[0_0_0_1px_rgba(244,246,248,0.65)]" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductView({ product }: { product: ProductViewData }) {
  const router = useRouter();
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? '');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [state, setState] = useState<CartActionState | null>(null);
  const [enviando, setEnviando] = useState(false);

  /**
   * La acción se llama a mano en vez de pasarla como `action` del formulario.
   *
   * Con `useActionState` el botón se quedaba en "Agregando…" y el mensaje no
   * aparecía nunca, aunque el producto sí entrara al carrito: la respuesta de
   * la acción arrastra el árbol revalidado del servidor y, hasta que ese
   * árbol termina de aplicarse, la transición sigue pendiente. Llamándola
   * así, la respuesta se usa apenas llega y el refresco del servidor va por
   * su cuenta.
   */
  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;

    const datos = new FormData(event.currentTarget);

    // La medida se toma antes de esperar al servidor: mientras la acción
    // viaja, el visitante puede desplazarse y el vuelo saldría de otro lugar.
    const fuente = document.querySelector<HTMLElement>('[data-fly-source]');
    const caja = fuente?.getBoundingClientRect();
    const origen = caja
      ? { x: caja.x, y: caja.y, width: caja.width, height: caja.height }
      : undefined;
    const imagen = fuente?.querySelector('img')?.currentSrc ?? images[0]?.url ?? null;

    setEnviando(true);
    try {
      const resultado = await addToCart(null, datos);
      setState(resultado);
      if (resultado.ok) {
        if (origen) flyToCart({ origin: origen, imageUrl: imagen });
        if (typeof resultado.count === 'number') {
          announceCart(resultado.count, { origin: origen, imageUrl: imagen });
        }
      }
      if (resultado.ok) router.refresh();
    } catch {
      setState({ ok: false, message: 'No se pudo agregar. Inténtalo de nuevo.' });
    } finally {
      setEnviando(false);
    }
  }
  const liveRef = useRef<HTMLParagraphElement>(null);
  const compraRef = useRef<HTMLDivElement>(null);
  const [barraVisible, setBarraVisible] = useState(false);

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

  // En el teléfono la foto ocupa casi toda la primera pantalla, así que el
  // botón de compra queda lejos. Mientras no se vea, una barra fija lo
  // reemplaza abajo.
  useEffect(() => {
    const objetivo = compraRef.current;
    if (!objetivo || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(
      ([entrada]) => setBarraVisible(!entrada.isIntersecting),
      { threshold: 0 },
    );
    observador.observe(objetivo);
    return () => observador.disconnect();
  }, []);

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

        {/* En el teléfono el color va aquí, a la vista de la foto que cambia. */}
        <ColorPicker
          colors={product.colors}
          activeId={color?.id}
          onPick={setColorId}
          className="mt-5 lg:hidden"
        />
      </div>

      {/* El relleno de abajo deja libre lo que tapa la barra de compra. Es
          fijo a propósito: si dependiera de si la barra se ve, aparecer
          movería el botón que el observador vigila, eso la escondería, y el
          movimiento volvería a mostrarla. */}
      <div className="pb-24 lg:pb-0">
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

        {product.rating.count > 0 ? (
          <a
            href="#opiniones"
            className="mt-3 inline-flex items-center gap-2 text-chalk-dim transition-colors hover:text-chalk"
          >
            <RatingSummary average={product.rating.average} count={product.rating.count} size="md" />
            <span className="text-[12.5px] underline underline-offset-4">Ver opiniones</span>
          </a>
        ) : null}

        {/* Precio */}
        <div className="mt-7">
          <Price amount={price} size="lg" />
          {product.installmentsMax > 1 ? (
            <p className="mt-2 text-[13.5px] text-chalk-dim">
              Hasta {product.installmentsMax} cuotas de{' '}
              <strong className="text-chalk">{formatCLP(installment(price, product.installmentsMax))}</strong>{' '}
              con Mercado Pago
            </p>
          ) : null}
        </div>

        <form id="compra" onSubmit={enviar} className="mt-8">
          <input type="hidden" name="variantId" value={variant?.id ?? ''} />
          <input type="hidden" name="quantity" value="1" />

          {/* Selector de color — en pantalla ancha vive junto a la talla. En el
              teléfono se muestra pegado a la foto (más arriba): acá abajo el
              visitante cambiaba de color sin ver la imagen que cambiaba. */}
          <ColorPicker
            colors={product.colors}
            activeId={color?.id}
            onPick={setColorId}
            className="mb-7 hidden lg:block"
          />

          {/* Selector de talla — el punto de mayor fricción del rubro */}
          <fieldset id="tallas" className="scroll-mt-24">
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
                    aria-label={`Talla ${v.size}${out ? ' agotada' : v.available <= SHOW_UNITS_LEFT ? `, quedan ${v.available}` : ''}`}
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
                    ) : v.available <= SHOW_UNITS_LEFT ? (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 bg-signal-warn" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Estado de stock en vivo */}
            <p ref={liveRef} aria-live="polite" className="mt-3 min-h-[20px] text-[13px]">
              {variant ? (
                variant.available <= SHOW_UNITS_LEFT ? (
                  <span className="text-signal-warn">
                    Quedan {variant.available} {variant.available === 1 ? 'unidad' : 'unidades'} de la talla{' '}
                    {variant.size} en {color ? colorLabel(color) : ''} · SKU {variant.sku}
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

          <div ref={compraRef} className="mt-6 space-y-3">
            <AddButton disabled={!variant} comingSoon={product.comingSoon} pending={enviando} />

            {state ? (
              <p
                role="status"
                className={cn(
                  'flex items-start gap-2 border px-3.5 py-3 text-[13.5px] animate-rise-in',
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

        {/* Homologación: va después de la compra. Es el argumento que cierra
            la decisión, pero quien entra busca primero precio, color y talla. */}
        {product.approvalCode ? (
          <div className="mt-8 border accent-border bg-ink-900">
            <div className="flex items-start gap-3.5 p-4">
              <IconShield className="mt-0.5 h-6 w-6 shrink-0 accent-text" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] font-semibold uppercase tracking-mega accent-text">
                  Homologado {product.approvalBody}
                  {product.approvalYear ? ` · ${product.approvalYear}` : ''}
                </p>
                <p className="mt-1.5 break-all font-mono text-[17px] font-medium leading-none tracking-wider text-chalk">
                  {product.approvalCode}
                </p>
                {product.approvalVerifyUrl ? (
                  <a
                    href={product.approvalVerifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest accent-text underline underline-offset-4"
                  >
                    Verificar en el registro oficial
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Barra de compra del teléfono */}
        {!product.comingSoon ? (
          <div
            aria-hidden={!barraVisible}
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur',
              'transition-transform duration-300 ease-tech lg:hidden',
              barraVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
            )}
          >
            <div className="container flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[17px] leading-none text-chalk">
                  {formatCLP(price)}
                </p>
                <p className="mt-1 truncate text-[12px] text-chalk-faint">
                  {variant ? `Talla ${variant.size} · ${color ? colorLabel(color) : ''}` : 'Elige tu talla'}
                </p>
              </div>

              {variant ? (
                <button
                  type="submit"
                  form="compra"
                  className="h-12 shrink-0 accent-bg px-6 font-display text-[12px] font-bold uppercase tracking-widest clip-notch-sm"
                >
                  Agregar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('tallas')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  className="h-12 shrink-0 border border-line-bright px-6 font-display text-[12px] font-bold uppercase tracking-widest text-chalk clip-notch-sm"
                >
                  Ver tallas
                </button>
              )}
            </div>
          </div>
        ) : null}

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
