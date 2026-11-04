'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveStockAdjustment, setVariantVisibility } from '@/actions/admin/inventory';
import {
  MAX_STOCK_CHANGE,
  STOCK_MODE_LABEL,
  stockDelta,
  type StockMode,
} from '@/lib/stock-adjustment-input';
import { cn } from '@/lib/utils';
import { IconBox, IconCheck, IconChevron, IconMinus, IconPlus } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';

export interface StockVariant {
  id: string;
  colorId: string;
  size: string;
  sku: string;
  stock: number;
  reserved: number;
  active: boolean;
  lowStockThreshold: number;
}

export interface StockProduct {
  id: string;
  name: string;
  modelCode: string;
  status: string;
  imageUrl: string | null;
  colors: { id: string; name: string; hex: string; active: boolean }[];
  variants: StockVariant[];
}

const STATUS: Record<string, string> = {
  ACTIVE: 'En la tienda',
  DRAFT: 'Borrador',
  COMING_SOON: 'Próximamente',
  ARCHIVED: 'Archivado',
};
const fieldClass =
  'h-11 rounded-lg border border-line-bright bg-ink px-3 text-sm text-chalk focus:border-[var(--accent)] focus:outline-none';

export function ProductStock({
  product: incoming,
  defaultOpen = false,
}: {
  product: StockProduct;
  defaultOpen?: boolean;
}) {
  const [confirmed, setConfirmed] = useState<{
    source: StockProduct;
    stocks: Record<string, { stock: number; reserved: number }>;
  } | null>(null);
  // La respuesta confirma los saldos antes de que termine de llegar la página actualizada.
  // Así se puede iniciar otro ajuste inmediatamente sin reutilizar cantidades antiguas.
  const product =
    confirmed?.source === incoming
      ? {
          ...incoming,
          variants: incoming.variants.map((v) => ({ ...v, ...confirmed.stocks[v.id] })),
        }
      : incoming;
  const [mode, setMode] = useState<'view' | StockMode | null>(defaultOpen ? 'view' : null);
  const [notice, setNotice] = useState('');
  const stock = product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  const reserved = product.variants.reduce((sum, v) => sum + v.reserved, 0);
  const missing = product.variants.reduce((sum, v) => sum + Math.max(0, -v.stock), 0);
  const editing = mode !== null && mode !== 'view';

  function open(next: typeof mode) {
    setNotice('');
    setMode(next);
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-ink-900"
      aria-label={product.name}
    >
      <div className="p-5 sm:p-6">
        <div className="flex gap-4">
          <div className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-ink-800 sm:h-24 sm:w-20">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <IconBox className="h-8 w-8 text-chalk-faint" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 break-words text-xs text-chalk-faint">
              {product.modelCode} · {STATUS[product.status]}
            </p>
            <h2 className="break-words text-base font-semibold normal-case tracking-normal sm:text-lg">
              {product.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {product.colors.slice(0, 6).map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="h-3.5 w-3.5 rounded-full border border-line-bright"
                  style={{ background: c.hex }}
                />
              ))}
              <span className="ml-1 text-xs text-chalk-faint">
                {product.colors.length} {product.colors.length === 1 ? 'color' : 'colores'} ·{' '}
                {new Set(product.variants.map((v) => v.size)).size} tallas
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums text-chalk sm:text-3xl">{stock}</p>
            <p className="text-xs text-chalk-faint">en stock</p>
          </div>
        </div>
        {reserved > 0 || missing > 0 ? (
          <p className="mt-3 text-xs text-signal-warn">
            {reserved > 0 ? `${reserved} unidades reservadas para pedidos. ` : ''}
            {missing > 0 ? `${missing} unidades pendientes de reponer por ventas sin stock.` : ''}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-lg !normal-case !tracking-normal ![clip-path:none]"
            disabled={editing || !product.variants.length}
            onClick={() => open('add')}
          >
            <IconPlus className="h-4 w-4" /> Agregar stock
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-lg !normal-case !tracking-normal ![clip-path:none]"
            disabled={editing || !product.variants.length}
            onClick={() => open('remove')}
          >
            <IconMinus className="h-4 w-4" /> Quitar stock
          </Button>
          <button
            type="button"
            disabled={editing || !product.variants.length}
            onClick={() => open(mode === 'view' ? null : 'view')}
            aria-expanded={mode !== null}
            className="ml-auto inline-flex min-h-11 items-center gap-1 px-2 text-sm text-chalk-dim hover:text-chalk disabled:opacity-40"
          >
            {mode === 'view' ? 'Cerrar tallas' : 'Ver tallas'}{' '}
            <IconChevron className={cn('h-3 w-3 transition-transform', mode && 'rotate-90')} />
          </button>
        </div>
        {!product.variants.length ? (
          <p className="mt-3 text-sm text-chalk-faint">
            Agrega un color y sus tallas desde{' '}
            <Link href={`/admin/productos/${product.id}`} className="accent-text underline">
              Editar producto
            </Link>
            .
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg bg-signal-ok/10 p-3 text-sm text-signal-ok"
          >
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </p>
        ) : null}
      </div>
      {mode === 'view' ? (
        <StockOverview product={product} onCount={() => open('count')} />
      ) : editing ? (
        <StockEditor
          key={mode}
          product={product}
          mode={mode}
          onClose={() => setMode('view')}
          onSaved={(message, stocks) => {
            setConfirmed((previous) => ({
              source: incoming,
              stocks: {
                ...(previous?.source === incoming ? previous.stocks : {}),
                ...Object.fromEntries(
                  stocks.map((v) => [v.id, { stock: v.stock, reserved: v.reserved }]),
                ),
              },
            }));
            setNotice(message);
            setMode('view');
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs sm:px-6">
        <Link
          href={`/admin/inventario/historial?producto=${product.id}`}
          className="text-chalk-dim hover:accent-text"
        >
          Ver historial de movimientos
        </Link>
        <Link href={`/admin/productos/${product.id}`} className="text-chalk-faint hover:text-chalk">
          Editar producto
        </Link>
      </div>
    </section>
  );
}

function ColorSelector({
  product,
  colorId,
  onChange,
}: {
  product: StockProduct;
  colorId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm text-chalk-dim">
      Color
      <select
        aria-label={`Color de ${product.name}`}
        value={colorId}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, 'max-w-full flex-1 sm:flex-none sm:min-w-48')}
      >
        {product.colors.map((color) => (
          <option key={color.id} value={color.id}>
            {color.name}
            {color.active ? '' : ' (oculto)'}
          </option>
        ))}
      </select>
    </label>
  );
}

function StockOverview({ product, onCount }: { product: StockProduct; onCount: () => void }) {
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? '');
  const [visibility, setVisibility] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const color = product.colors.find((c) => c.id === colorId);
  const variants = product.variants.filter((v) => v.colorId === colorId);

  return (
    <div className="border-t border-line bg-ink/40 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ColorSelector product={product} colorId={colorId} onChange={setColorId} />
        <span className="text-xs text-chalk-faint">Stock por talla</span>
      </div>
      {color && !color.active ? (
        <p className="mb-4 text-sm text-signal-warn">
          Este color está oculto. Puedes volver a mostrarlo desde Editar producto → Colores.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {variants.map((v) => {
          const available = Math.max(0, v.stock - v.reserved);
          return (
            <div
              key={v.id}
              className={cn(
                'rounded-xl border p-3',
                v.stock <= 0 ? 'border-signal-bad/20 bg-signal-bad/5' : 'border-line bg-ink-900',
              )}
            >
              <p className="text-xs text-chalk-dim">
                Talla <strong className="text-sm text-chalk">{v.size}</strong>
              </p>
              <p
                className={cn(
                  'mt-2 text-2xl font-semibold tabular-nums',
                  v.stock <= 0
                    ? 'text-signal-bad'
                    : available <= v.lowStockThreshold
                      ? 'text-signal-warn'
                      : 'text-chalk',
                )}
              >
                {v.stock}
              </p>
              <p className="mt-1 text-xs text-chalk-faint">
                {v.stock < 0
                  ? 'Pendiente de reponer'
                  : v.stock === 0
                    ? 'Sin stock'
                    : available <= v.lowStockThreshold
                      ? 'Stock bajo'
                      : 'En stock'}
              </p>
              {v.reserved > 0 ? (
                <p className="mt-1 text-xs text-signal-warn">
                  {v.reserved} reservadas · {available} libres
                </p>
              ) : null}
              {!v.active ? (
                <p className="mt-2 text-xs text-chalk-faint">Oculta en la tienda</p>
              ) : null}
              {visibility ? (
                <button
                  type="button"
                  disabled={pending}
                  className="mt-3 min-h-10 w-full rounded-lg border border-line-bright px-2 text-xs text-chalk-dim hover:text-chalk disabled:opacity-40"
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        setMessage(await setVariantVisibility(v.id, !v.active));
                      } catch {
                        setMessage({
                          ok: false,
                          message: 'No se pudo cambiar la visibilidad. Reintenta.',
                        });
                      }
                    })
                  }
                >
                  {v.active ? `Ocultar talla ${v.size}` : `Mostrar talla ${v.size}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {message ? (
        <p
          role="status"
          className={cn('mt-3 text-sm', message.ok ? 'text-signal-ok' : 'text-signal-bad')}
        >
          {message.message}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs">
        <button
          type="button"
          onClick={onCount}
          className="min-h-9 text-chalk-dim hover:accent-text"
        >
          Corregir conteo
        </button>
        <button
          type="button"
          onClick={() => setVisibility(!visibility)}
          aria-expanded={visibility}
          className="min-h-9 text-chalk-dim hover:accent-text"
        >
          {visibility ? 'Cerrar visibilidad' : 'Mostrar u ocultar tallas'}
        </button>
        {visibility ? (
          <p className="w-full text-chalk-faint">
            Ocultar conserva las unidades y el historial. Puedes volver a mostrar cada talla aquí.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StockEditor({
  product,
  mode,
  onClose,
  onSaved,
}: {
  product: StockProduct;
  mode: StockMode;
  onClose: () => void;
  onSaved: (message: string, stocks: { id: string; stock: number; reserved: number }[]) => void;
}) {
  // Mantener la foto inicial mientras se edita permite detectar ventas o reservas concurrentes.
  const [snapshot] = useState(product);
  const [colorId, setColorId] = useState(snapshot.colors[0]?.id ?? '');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const changed = snapshot.variants.filter(
    (v) =>
      quantities[v.id]?.trim() &&
      (mode === 'count' ? Number(quantities[v.id]) !== v.stock : Number(quantities[v.id]) !== 0),
  );
  const invalid = changed.some((v) => {
    const quantity = Number(quantities[v.id]);
    const delta = stockDelta(mode, quantity, v.stock);
    return (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_STOCK_CHANGE ||
      (delta < 0 && v.stock + delta < Math.max(0, v.reserved))
    );
  });
  const units = changed.reduce(
    (sum, v) => sum + Math.abs(stockDelta(mode, Number(quantities[v.id]), v.stock)),
    0,
  );

  function update(id: string, value: string) {
    setQuantities((old) => ({ ...old, [id]: value }));
    setOperationId(crypto.randomUUID());
    setError('');
  }

  return (
    <form
      aria-label={`${STOCK_MODE_LABEL[mode]} de ${snapshot.name}`}
      className="border-t border-line bg-ink/40 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || invalid || !changed.length) return;
        setError('');
        startTransition(async () => {
          try {
            const result = await saveStockAdjustment({
              productId: snapshot.id,
              mode,
              operationId,
              note,
              items: changed.map((v) => ({
                variantId: v.id,
                quantity: Number(quantities[v.id]),
                expectedStock: v.stock,
                expectedReserved: v.reserved,
              })),
            });
            if (result.ok) onSaved(result.message, result.stocks ?? []);
            else setError(result.message);
          } catch {
            setError(
              'No se pudo confirmar el cambio. Reintenta sin modificar las cantidades para evitar duplicarlo.',
            );
          }
        });
      }}
    >
      <fieldset disabled={pending}>
        <legend className="mb-1 text-base font-semibold text-chalk">
          {STOCK_MODE_LABEL[mode]}
        </legend>
        <p className="mb-5 text-sm text-chalk-dim">
          {mode === 'add'
            ? 'Escribe cuántas unidades llegaron de cada talla.'
            : mode === 'remove'
              ? 'Escribe cuántas unidades necesitas retirar de cada talla.'
              : 'Escribe el total real que contaste, incluyendo las unidades reservadas.'}{' '}
          Puedes cambiar de color antes de guardar.
        </p>
        <ColorSelector product={snapshot} colorId={colorId} onChange={setColorId} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {snapshot.variants
            .filter((v) => v.colorId === colorId)
            .map((v) => {
              const value = quantities[v.id] ?? '';
              const delta = value.trim() ? stockDelta(mode, Number(value), v.stock) : 0;
              const next = v.stock + delta;
              const invalidCell =
                value.trim() &&
                (!Number.isInteger(Number(value)) ||
                  Number(value) < 0 ||
                  Number(value) > MAX_STOCK_CHANGE ||
                  (delta < 0 && next < Math.max(0, v.reserved)));
              return (
                <div
                  key={v.id}
                  className={cn(
                    'rounded-xl border bg-ink-900 p-3',
                    invalidCell ? 'border-signal-bad' : delta ? 'accent-border' : 'border-line',
                  )}
                >
                  <label
                    htmlFor={`amount-${v.id}`}
                    className="mb-2 block text-sm font-medium text-chalk"
                  >
                    Talla {v.size}
                  </label>
                  <p className="mb-3 text-xs text-chalk-faint">
                    Actual: <span className="text-chalk-dim">{v.stock}</span>
                    {v.reserved > 0 ? ` · ${v.reserved} reservadas` : ''}
                  </p>
                  <input
                    id={`amount-${v.id}`}
                    aria-label={`${mode === 'add' ? 'Agregar' : mode === 'remove' ? 'Quitar' : 'Conteo'} talla ${v.size}`}
                    type="number"
                    min={0}
                    max={mode === 'remove' ? Math.max(0, v.stock - v.reserved) : MAX_STOCK_CHANGE}
                    step={1}
                    inputMode="numeric"
                    value={value}
                    placeholder="0"
                    onChange={(e) => update(v.id, e.target.value)}
                    className={cn(fieldClass, 'w-full text-center text-lg')}
                    aria-invalid={Boolean(invalidCell)}
                  />
                  <p
                    className={cn(
                      'mt-3 text-xs',
                      invalidCell ? 'text-signal-bad' : delta ? 'accent-text' : 'text-chalk-faint',
                    )}
                  >
                    {invalidCell ? 'Revisa la cantidad' : `Quedarán: ${next}`}
                  </p>
                  {!v.active ? <p className="mt-1 text-xs text-chalk-faint">Talla oculta</p> : null}
                </div>
              );
            })}
        </div>
        {changed.length ? (
          <div className="mt-5 rounded-xl border border-line bg-ink-800 p-4">
            <p className="text-sm font-medium text-chalk">
              Revisa el cambio · {Number.isFinite(units) ? units : '—'} unidades · {changed.length}{' '}
              tallas y colores
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-chalk-dim">
              {changed.map((v) => (
                <li key={v.id} className="flex justify-between gap-3">
                  <span>
                    {snapshot.colors.find((c) => c.id === v.colorId)?.name} · Talla {v.size}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-chalk">
                    {v.stock} → {v.stock + stockDelta(mode, Number(quantities[v.id]), v.stock)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <label className="mt-5 block text-sm text-chalk-dim">
          Nota <span className="text-chalk-faint">(opcional)</span>
          <input
            value={note}
            maxLength={300}
            onChange={(e) => {
              setNote(e.target.value);
              setOperationId(crypto.randomUUID());
            }}
            placeholder={
              mode === 'add'
                ? 'Ej. Reposición de noviembre'
                : mode === 'remove'
                  ? 'Ej. Prenda dañada'
                  : 'Ej. Recuento de bodega'
            }
            className={cn(fieldClass, 'mt-2 w-full')}
          />
        </label>
      </fieldset>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-signal-bad/40 bg-signal-bad/10 p-3 text-sm text-signal-bad"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending || invalid || !changed.length}
          className="rounded-lg !normal-case !tracking-normal ![clip-path:none]"
        >
          {pending
            ? 'Guardando…'
            : mode === 'add'
              ? 'Guardar entrada'
              : mode === 'remove'
                ? 'Guardar salida'
                : 'Guardar conteo'}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="min-h-11 px-3 text-sm text-chalk-dim hover:text-chalk disabled:opacity-40"
        >
          Cancelar
        </button>
        <p className="w-full text-xs text-chalk-faint">
          Solo se guardan las tallas que completaste. Cada cambio queda en el historial.
        </p>
      </div>
    </form>
  );
}
