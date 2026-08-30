'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeCartItem, updateCartItem } from '@/actions/cart';
import type { CartLine } from '@/lib/cart';
import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';
import { IconMinus, IconPlus, IconTrash } from '@/components/ui/Icons';

export function CartLineItem({ line, compact }: { line: CartLine; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function change(quantity: number) {
    startTransition(async () => {
      await updateCartItem(line.itemId, quantity);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItem(line.itemId);
      router.refresh();
    });
  }

  return (
    <li className={cn('flex gap-4 py-5 transition-opacity', pending && 'opacity-50')}>
      <Link
        href={`/producto/${line.slug}`}
        className={cn('relative shrink-0 overflow-hidden border border-line bg-ink-800', compact ? 'h-20 w-16' : 'h-28 w-[90px]')}
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.productName} fill sizes="90px" className="object-cover" />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] leading-tight tracking-tight text-chalk">
              <Link href={`/producto/${line.slug}`} className="hover:accent-text">
                {line.productName}
              </Link>
            </h3>
            <p className="mt-1 text-[13px] text-chalk-faint">
              {line.colorName} · Talla {line.size}
            </p>
            <p className="mt-0.5 font-mono text-[11.5px] text-chalk-faint/80">{line.sku}</p>
          </div>

          <p className="shrink-0 text-right font-display text-[15px] font-semibold text-chalk">
            {formatCLP(line.lineTotal)}
          </p>
        </div>

        {line.overStock ? (
          <p className="mt-2 border border-signal-warn/40 bg-signal-warn/10 px-2.5 py-1.5 text-[12.5px] text-signal-warn">
            {line.available === 0
              ? 'Se agotó mientras estaba en tu carrito. Quítalo para continuar.'
              : `Solo quedan ${line.available} unidades. Ajusta la cantidad para continuar.`}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex items-center border border-line">
            <button
              type="button"
              onClick={() => change(line.quantity - 1)}
              disabled={pending}
              aria-label="Quitar una unidad"
              className="flex h-9 w-9 items-center justify-center text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk disabled:opacity-40"
            >
              <IconMinus className="h-3.5 w-3.5" />
            </button>
            <span aria-live="polite" className="w-9 text-center font-display text-[14px] font-semibold text-chalk">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => change(line.quantity + 1)}
              disabled={pending || line.quantity >= line.available}
              aria-label="Agregar una unidad"
              className="flex h-9 w-9 items-center justify-center text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk disabled:opacity-40"
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-chalk-faint transition-colors hover:text-signal-bad"
          >
            <IconTrash className="h-4 w-4" />
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}
