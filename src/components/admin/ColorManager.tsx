'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteColor, saveColor, type AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface ColorRow {
  id: string;
  name: string;
  code: string | null;
  hex: string;
  accentHex: string;
  stripCode: string | null;
  stripHex: string | null;
  active: boolean;
  sortOrder: number;
  variantCount: number;
  stock: number;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function ColorFields({
  productId,
  color,
  onDone,
}: {
  productId: string;
  color?: ColorRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveColor, null);
  const [hex, setHex] = useState(color?.hex ?? '#000000');
  const [accent, setAccent] = useState(color?.accentHex ?? '#00E0B8');
  const [strip, setStrip] = useState(color?.stripHex ?? '');
  const router = useRouter();

  if (state?.ok) {
    setTimeout(() => {
      router.refresh();
      onDone();
    }, 250);
  }

  return (
    <form action={action} className="border border-line bg-ink-800 p-4">
      <input type="hidden" name="productId" value={productId} />
      {color ? <input type="hidden" name="id" value={color.id} /> : null}

      {state && !state.ok ? (
        <p role="alert" className="mb-3 border border-signal-bad/40 bg-signal-bad/10 px-3 py-2 text-[12.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Nombre
          </span>
          <input
            name="name"
            required
            defaultValue={color?.name}
            placeholder="Azul Marino"
            className="h-10 w-full border border-line bg-ink-900 px-3 text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Código de colorway
          </span>
          <input
            name="code"
            defaultValue={color?.code ?? ''}
            placeholder="60289"
            className="h-10 w-full border border-line bg-ink-900 px-3 font-mono text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Color del swatch
          </span>
          <span className="flex h-10 items-center gap-2 border border-line bg-ink-900 px-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              aria-label="Selector de color"
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              name="hex"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="w-full bg-transparent font-mono text-[13px] uppercase text-chalk focus:outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Acento en la ficha
          </span>
          <span className="flex h-10 items-center gap-2 border border-line bg-ink-900 px-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="Selector de acento"
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              name="accentHex"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-full bg-transparent font-mono text-[13px] uppercase text-chalk focus:outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Código del vivo
          </span>
          <input
            name="stripCode"
            defaultValue={color?.stripCode ?? ''}
            placeholder="0524"
            className="h-10 w-full border border-line bg-ink-900 px-3 font-mono text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Color del vivo
          </span>
          <span className="flex h-10 items-center gap-2 border border-line bg-ink-900 px-2">
            <input
              type="color"
              value={strip || '#888888'}
              onChange={(e) => setStrip(e.target.value)}
              aria-label="Selector del color del vivo"
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              name="stripHex"
              value={strip}
              onChange={(e) => setStrip(e.target.value)}
              placeholder="sin definir"
              className="w-full bg-transparent font-mono text-[13px] uppercase text-chalk placeholder:normal-case placeholder:text-chalk-faint/70 focus:outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Orden
          </span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={String(color?.sortOrder ?? 0)}
            className="h-10 w-full border border-line bg-ink-900 px-3 text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="flex items-end gap-2 pb-2 text-[13px] text-chalk-dim">
          <input
            type="checkbox"
            name="active"
            defaultChecked={color?.active ?? true}
            className="h-4 w-4 cursor-pointer appearance-none border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
          />
          Visible en la tienda
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Submit label={color ? 'Guardar' : 'Crear'} />
        <button
          type="button"
          onClick={onDone}
          className="h-10 px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
        >
          Cancelar
        </button>
      </div>

      {!color ? (
        <p className="mt-3 text-[12px] text-chalk-faint">
          Al crear el colorway se generan sus tallas con stock en cero.
        </p>
      ) : null}
    </form>
  );
}

export function ColorManager({ productId, colors }: { productId: string; colors: ColorRow[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      {colors.map((color) =>
        editing === color.id ? (
          <ColorFields key={color.id} productId={productId} color={color} onDone={() => setEditing(null)} />
        ) : (
          <div
            key={color.id}
            className={cn('flex flex-wrap items-center gap-4 border border-line bg-ink-900 px-4 py-3', pending && 'opacity-60')}
          >
            <span className="h-8 w-8 shrink-0 border border-line-bright" style={{ background: color.hex }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] text-chalk">
                {color.name}
                {color.code ? (
                  <span className="font-mono text-[12px] text-chalk-faint">{color.code}</span>
                ) : null}
                {!color.active ? <Badge tone="muted">Oculto</Badge> : null}
              </p>
              <p className="font-mono text-[11.5px] text-chalk-faint">
                {color.hex.toUpperCase()}
                {color.stripCode ? ` · vivo ${color.stripCode}` : ' · sin vivo'}
                {color.stripHex ? ` ${color.stripHex.toUpperCase()}` : ''}
              </p>
            </div>
            <p className="shrink-0 text-[12.5px] text-chalk-faint">
              {color.variantCount} tallas · <span className="text-chalk">{color.stock}</span> u.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(color.id)}
                className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar el colorway ${color.name}? Se eliminan sus ${color.variantCount} SKU y sus imágenes.`)) {
                    startTransition(async () => {
                      await deleteColor(color.id);
                      router.refresh();
                    });
                  }
                }}
                aria-label={`Eliminar ${color.name}`}
                className="text-chalk-faint hover:text-signal-bad"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
        ),
      )}

      {editing === 'new' ? (
        <ColorFields productId={productId} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-line-bright py-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:border-chalk hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar colorway
        </button>
      )}
    </div>
  );
}
