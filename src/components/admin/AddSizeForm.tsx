'use client';

import { useActionState } from 'react';
import { addSize } from '@/actions/admin/products';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function AddSizeForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(addSize, null);
  return (
    <details className="rounded-xl border border-line bg-ink-900 p-5">
      <summary className="cursor-pointer text-sm font-medium text-chalk">Agregar una talla</summary>
      <p className="mt-3 text-sm text-chalk-faint">
        La nueva talla se agrega a todos los colores con stock en cero.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        <label className="text-sm text-chalk-dim">
          Talla
          <input
            name="size"
            required
            maxLength={20}
            placeholder="Ej. 38 o XL"
            className="mt-2 block h-11 w-40 rounded-lg border border-line-bright bg-ink px-3 text-sm text-chalk"
          />
        </label>
        <Button
          type="submit"
          disabled={pending}
          className="rounded-lg !normal-case !tracking-normal ![clip-path:none]"
        >
          {pending ? 'Agregando…' : 'Agregar talla'}
        </Button>
        {state ? (
          <p
            role="status"
            className={cn('w-full text-sm', state.ok ? 'text-signal-ok' : 'text-signal-bad')}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
