'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteColor, saveColor, type AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface ColorRow {
  id: string;
  name: string;
  hex: string;
  accentHex: string;
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

      <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
            Nombre del color
          </span>
          <input
            name="name"
            required
            defaultValue={color?.name}
            placeholder="Azul Cobalto"
            className="h-10 w-full border border-line bg-ink-900 px-3 text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
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

        <div className="flex items-center gap-2">
          <Submit label={color ? 'Guardar' : 'Crear'} />
          <button
            type="button"
            onClick={onDone}
            className="h-10 px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
          >
            Cancelar
          </button>
        </div>
      </div>

      {!color ? (
        <p className="mt-3 text-[12px] text-chalk-faint">
          Al crear el color se generan automáticamente todas las tallas del producto con stock en cero.
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
              <p className="text-[14px] text-chalk">{color.name}</p>
              <p className="font-mono text-[11.5px] text-chalk-faint">
                {color.hex.toUpperCase()} · acento {color.accentHex.toUpperCase()}
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
                  if (confirm(`¿Eliminar el color ${color.name}? Se eliminan sus ${color.variantCount} SKU y sus imágenes.`)) {
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
          Agregar color
        </button>
      )}
    </div>
  );
}
