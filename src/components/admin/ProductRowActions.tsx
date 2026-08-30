'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProduct, duplicateProduct, setProductStatus } from '@/actions/admin/products';
import { IconCopy, IconExternal, IconTrash } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export function ProductRowActions({
  id,
  slug,
  status,
  name,
}: {
  id: string;
  slug: string;
  status: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className={cn('relative inline-flex items-center gap-2', pending && 'opacity-50')}>
      <Link
        href={`/admin/productos/${id}`}
        className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
      >
        Editar
      </Link>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Más acciones para ${name}`}
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center border border-line text-chalk-faint hover:border-line-bright hover:text-chalk"
      >
        <span aria-hidden className="text-[15px] leading-none">⋯</span>
      </button>

      {open ? (
        <>
          <span className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-40 mt-1 w-52 border border-line bg-ink-800 py-1 text-left shadow-lift">
            <Link
              href={`/producto/${slug}`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-chalk-dim hover:bg-ink-700 hover:text-chalk"
            >
              <IconExternal className="h-3.5 w-3.5" />
              Ver en la tienda
            </Link>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await duplicateProduct(id);
                });
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-chalk-dim hover:bg-ink-700 hover:text-chalk"
            >
              <IconCopy className="h-3.5 w-3.5" />
              Duplicar
            </button>

            {status !== 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTransition(async () => {
                    await setProductStatus(id, 'ACTIVE');
                    router.refresh();
                  });
                }}
                className="w-full px-3 py-2 pl-8 text-left text-[13px] text-chalk-dim hover:bg-ink-700 hover:text-chalk"
              >
                Activar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTransition(async () => {
                    await setProductStatus(id, 'DRAFT');
                    router.refresh();
                  });
                }}
                className="w-full px-3 py-2 pl-8 text-left text-[13px] text-chalk-dim hover:bg-ink-700 hover:text-chalk"
              >
                Pasar a borrador
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (confirm(`¿Eliminar "${name}"? Si tiene ventas se archivará en vez de borrarse.`)) {
                  startTransition(async () => {
                    await deleteProduct(id);
                  });
                }
              }}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-[13px] text-signal-bad hover:bg-signal-bad/10"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
