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

type StockUpdate = Partial<Pick<StockVariant, 'stock' | 'reserved' | 'active'>>;

const STATUS: Record<string, string> = {
  ACTIVE: 'En la tienda',
  DRAFT: 'Borrador',
  COMING_SOON: 'Próximamente',
  ARCHIVED: 'Archivado',
};
const fieldClass =
  'h-11 rounded-md border border-line bg-transparent px-3 text-sm text-chalk focus:border-[var(--accent)] focus:outline-none';

export function ProductStock({
  product: incoming,
  defaultOpen = false,
}: {
  product: StockProduct;
  defaultOpen?: boolean;
}) {
  const [confirmed, setConfirmed] = useState<{
    source: StockProduct;
    stocks: Record<string, StockUpdate>;
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

  function confirmVariants(
    changes: ({ id: string } & StockUpdate)[],
  ) {
    setConfirmed((previous) => {
      const stocks: Record<string, StockUpdate> = previous?.source === incoming ? { ...previous.stocks } : {};
      for (const { id, ...fields } of changes) stocks[id] = { ...stocks[id], ...fields };
      return { source: incoming, stocks };
    });
  }

  function open(next: typeof mode) {
    setNotice('');
    setMode(next);
  }

  return (
    <section className="min-w-0" aria-label={product.name}>
      <div className="p-5 sm:p-6">
        <div className="flex gap-4">
          <div className="relative flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink-800">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <IconBox className="h-6 w-6 text-chalk-faint" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-base font-semibold normal-case tracking-normal">
              {product.name}
            </h2>
            <p className="mt-1 break-words text-xs leading-relaxed text-chalk-faint">
              {product.modelCode} · {product.colors.length}{' '}
              {product.colors.length === 1 ? 'color' : 'colores'} ·{' '}
              {new Set(product.variants.map((v) => v.size)).size}{' '}
              {new Set(product.variants.map((v) => v.size)).size === 1 ? 'talla' : 'tallas'}
              {product.status !== 'ACTIVE' ? ` · ${STATUS[product.status]}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-medium tabular-nums text-chalk">{stock}</p>
            <p className="text-xs text-chalk-faint">en stock</p>
          </div>
        </div>
        {reserved > 0 || missing > 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-chalk-faint sm:ml-16">
            {reserved > 0
              ? `${reserved} ${reserved === 1 ? 'unidad reservada' : 'unidades reservadas'}. `
              : ''}
            {missing > 0
              ? `${missing} ${missing === 1 ? 'unidad pendiente' : 'unidades pendientes'} de reponer.`
              : ''}
          </p>
        ) : null}
        {!editing ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 sm:ml-16">
            <button
              type="button"
              disabled={!product.variants.length}
              onClick={() => open('add')}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-chalk hover:accent-text disabled:opacity-40"
            >
              <IconPlus className="h-3.5 w-3.5" /> Agregar stock
            </button>
            <button
              type="button"
              disabled={!product.variants.length}
              onClick={() => open('remove')}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-chalk-dim hover:text-chalk disabled:opacity-40"
            >
              <IconMinus className="h-3.5 w-3.5" /> Quitar stock
            </button>
            <button
              type="button"
              disabled={!product.variants.length}
              onClick={() => open(mode === 'view' ? null : 'view')}
              aria-expanded={mode === 'view'}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-chalk-dim hover:text-chalk disabled:opacity-40"
            >
              {mode === 'view' ? 'Cerrar tallas' : 'Ver tallas'}
              <IconChevron
                className={cn('h-3 w-3 transition-transform', mode === 'view' && 'rotate-90')}
              />
            </button>
            {mode === null ? (
              <div className="flex flex-wrap items-center gap-x-5 text-xs sm:ml-auto">
                <Link
                  href={`/admin/inventario/historial?producto=${product.id}`}
                  className="inline-flex min-h-9 items-center text-chalk-faint hover:text-chalk"
                >
                  Ver historial de movimientos
                </Link>
                <Link
                  href={`/admin/productos/${product.id}`}
                  className="inline-flex min-h-9 items-center text-chalk-faint hover:text-chalk"
                >
                  Editar producto
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
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
          <p role="status" className="mt-3 flex items-start gap-2 text-sm text-chalk-dim sm:ml-16">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal-ok" />
            {notice}
          </p>
        ) : null}
      </div>
      {mode === 'view' ? (
        <StockOverview
          product={product}
          onCount={() => open('count')}
          onVisibilitySaved={(id, active) => confirmVariants([{ id, active }])}
        />
      ) : editing ? (
        <StockEditor
          key={mode}
          product={product}
          mode={mode}
          onClose={() => setMode('view')}
          onSaved={(message, stocks) => {
            confirmVariants(stocks);
            setNotice(message);
            setMode('view');
          }}
        />
      ) : null}
      {mode === 'view' ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 pb-4 text-xs sm:pl-[88px] sm:pr-6">
          <Link
            href={`/admin/inventario/historial?producto=${product.id}`}
            className="inline-flex min-h-9 items-center text-chalk-faint hover:text-chalk"
          >
            Ver historial de movimientos
          </Link>
          <Link
            href={`/admin/productos/${product.id}`}
            className="inline-flex min-h-9 items-center text-chalk-faint hover:text-chalk"
          >
            Editar producto
          </Link>
        </div>
      ) : null}
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
          <option key={color.id} value={color.id} className="bg-ink-900 text-chalk">
            {color.name}
            {color.active ? '' : ' (oculto)'}
          </option>
        ))}
      </select>
    </label>
  );
}

function StockOverview({
  product,
  onCount,
  onVisibilitySaved,
}: {
  product: StockProduct;
  onCount: () => void;
  onVisibilitySaved: (id: string, active: boolean) => void;
}) {
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? '');
  const [visibility, setVisibility] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const color = product.colors.find((c) => c.id === colorId);
  const variants = product.variants.filter((v) => v.colorId === colorId);

  return (
    <div className="px-5 pb-3 sm:pl-[88px] sm:pr-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ColorSelector product={product} colorId={colorId} onChange={setColorId} />
      </div>
      {color && !color.active ? (
        <p className="mb-4 text-sm text-chalk-dim">
          Este color está oculto. Puedes volver a mostrarlo desde Editar producto → Colores.
        </p>
      ) : null}
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Stock por talla de {color?.name}</caption>
        <thead>
          <tr className="border-b border-line text-xs text-chalk-faint">
            <th scope="col" className="py-3 text-left font-normal">
              Talla
            </th>
            <th scope="col" className="px-2 py-3 text-right font-normal">
              En stock
            </th>
            <th scope="col" className="py-3 text-right font-normal">
              {visibility ? 'En la tienda' : 'Disponibles'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {variants.map((v) => {
            const available = Math.max(0, v.stock - v.reserved);
            return (
              <tr key={v.id}>
                <th scope="row" className="py-3 text-left font-normal">
                  <span className="font-medium text-chalk">{v.size}</span>
                  {!v.active ? <span className="ml-2 text-xs text-chalk-faint">Oculta</span> : null}
                </th>
                <td className="px-2 py-3 text-right tabular-nums">
                  <span className={v.stock < 0 ? 'text-signal-bad' : 'text-chalk-dim'}>
                    {v.stock}
                  </span>
                  {v.reserved > 0 ? (
                    <span className="mt-0.5 block text-[11px] text-chalk-faint">
                      {v.reserved} {v.reserved === 1 ? 'reservada' : 'reservadas'}
                    </span>
                  ) : null}
                  {v.stock < 0 ? (
                    <span className="mt-0.5 block text-[11px] text-chalk-faint">Por reponer</span>
                  ) : null}
                </td>
                <td className="py-3 text-right tabular-nums text-chalk-dim">
                  {visibility ? (
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`${v.active ? 'Ocultar' : 'Mostrar'} talla ${v.size}`}
                      className="min-h-10 text-xs text-chalk-dim hover:accent-text disabled:opacity-40"
                      onClick={async () => {
                        if (pending) return;
                        setPending(true);
                        try {
                          const result = await setVariantVisibility(v.id, !v.active);
                          setMessage(result);
                          if (result.ok) onVisibilitySaved(v.id, !v.active);
                        } catch {
                          setMessage({
                            ok: false,
                            message: 'No se pudo cambiar la visibilidad. Reintenta.',
                          });
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {v.active ? 'Ocultar' : 'Mostrar'}
                    </button>
                  ) : available === 0 ? (
                    <span className="text-xs text-chalk-faint">Sin stock</span>
                  ) : (
                    <span>
                      {available}
                      {available <= v.lowStockThreshold ? (
                        <span className="mt-0.5 block text-[11px] text-chalk-faint">
                          Stock bajo
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {message ? (
        <p
          role="status"
          className={cn('mt-3 text-sm', message.ok ? 'text-chalk-dim' : 'text-signal-bad')}
        >
          {message.message}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <button
          type="button"
          onClick={onCount}
          className="min-h-10 text-chalk-dim hover:accent-text"
        >
          Corregir conteo
        </button>
        <button
          type="button"
          onClick={() => setVisibility(!visibility)}
          aria-expanded={visibility}
          className="min-h-10 text-chalk-dim hover:accent-text"
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
      className="px-5 pb-6 sm:pl-[88px] sm:pr-6"
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
        <legend className="mb-1 text-sm font-semibold text-chalk">{STOCK_MODE_LABEL[mode]}</legend>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-chalk-faint">
          {mode === 'add'
            ? 'Escribe cuántas unidades llegaron de cada talla.'
            : mode === 'remove'
              ? 'Escribe cuántas unidades necesitas retirar de cada talla.'
              : 'Escribe el total real que contaste, incluyendo las unidades reservadas.'}{' '}
          Puedes cambiar de color antes de guardar.
        </p>
        <ColorSelector product={snapshot} colorId={colorId} onChange={setColorId} />
        <table className="mt-4 w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{STOCK_MODE_LABEL[mode]} por talla</caption>
          <thead>
            <tr className="border-b border-line text-[11px] text-chalk-faint sm:text-xs">
              <th scope="col" className="w-1/4 py-3 text-left font-normal">
                Talla
              </th>
              <th scope="col" className="w-1/4 px-1 py-3 text-right font-normal">
                Actual
              </th>
              <th scope="col" className="w-1/4 px-1 py-3 text-center font-normal">
                {mode === 'add' ? 'Agregar' : mode === 'remove' ? 'Quitar' : 'Conteo'}
              </th>
              <th scope="col" className="w-1/4 py-3 text-right font-normal">
                Quedarán
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
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
                  <tr key={v.id}>
                    <th scope="row" className="py-3 text-left font-normal">
                      <label htmlFor={`amount-${v.id}`} className="font-medium text-chalk">
                        {v.size}
                      </label>
                      {!v.active ? (
                        <span className="mt-0.5 block text-[11px] text-chalk-faint">Oculta</span>
                      ) : null}
                    </th>
                    <td className="px-1 py-3 text-right tabular-nums text-chalk-faint">
                      {v.stock}
                      {v.reserved > 0 ? (
                        <span className="mt-0.5 block text-[10px] sm:text-[11px]">
                          {v.reserved} {v.reserved === 1 ? 'reservada' : 'reservadas'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        id={`amount-${v.id}`}
                        aria-label={`${mode === 'add' ? 'Agregar' : mode === 'remove' ? 'Quitar' : 'Conteo'} talla ${v.size}`}
                        type="number"
                        min={0}
                        max={
                          mode === 'remove' ? Math.max(0, v.stock - v.reserved) : MAX_STOCK_CHANGE
                        }
                        step={1}
                        inputMode="numeric"
                        value={value}
                        placeholder="0"
                        onChange={(e) => update(v.id, e.target.value)}
                        className={cn(
                          fieldClass,
                          'w-full max-w-24 px-1 text-center tabular-nums',
                          invalidCell && 'border-signal-bad',
                        )}
                        aria-invalid={Boolean(invalidCell)}
                      />
                    </td>
                    <td
                      className={cn(
                        'py-3 text-right tabular-nums',
                        invalidCell
                          ? 'text-signal-bad'
                          : delta
                            ? 'font-semibold text-chalk'
                            : 'text-chalk-faint',
                      )}
                    >
                      {invalidCell ? <span className="text-[11px]">Revisa la cantidad</span> : next}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {changed.length ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-medium text-chalk">
              Revisa el cambio · {Number.isFinite(units) ? units : '—'}{' '}
              {units === 1 ? 'unidad' : 'unidades'} · {changed.length}{' '}
              {changed.length === 1 ? 'talla y color' : 'tallas y colores'}
            </p>
            <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-chalk-faint">
              {changed.map((v) => (
                <li key={v.id} className="flex justify-between gap-3">
                  <span>
                    {snapshot.colors.find((c) => c.id === v.colorId)?.name} · Talla {v.size}
                  </span>
                  <span className="shrink-0 tabular-nums text-chalk-dim">
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
