'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatCLP } from '@/lib/money';
import type { TopSizeDeal } from '@/lib/catalog';
import { SaleCountdown } from './SaleBadge';

const STORAGE_KEY = 'taupoc:oferta:visto';
/** Vuelve a salir pasado un día, o antes si cambia la oferta. */
const SNOOZE_MS = 86_400_000;
const OPEN_DELAY_MS = 1500;
const HIDDEN_ON = ['/checkout', '/carrito', '/cuenta', '/devoluciones'];

/**
 * Marca global de la página: con el popup de oferta ya mostrado, la ruleta
 * no se abre sola en la misma visita. Dos ventanas seguidas espantan.
 */
export const POPUP_FLAG = '__taupocPopupMostrado';

function read(): { key: string; at: number } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { key: string; at: number }) : null;
  } catch {
    return null;
  }
}
function write(key: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, at: Date.now() }));
  } catch {
    /* sin almacenamiento sale en cada visita; no es grave */
  }
}

/**
 * Popup de entrada con la mejor oferta por talla: el descuento en grande,
 * el producto, la talla y un botón. Nada más.
 */
export function DealPopup({ deal }: { deal: TopSizeDeal }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const dealKey = `${deal.productId}:${deal.size}:${deal.percent}`;
  const productPath = deal.href.split('?')[0];
  const hidden =
    HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith(productPath);

  useEffect(() => {
    if (hidden) return;
    const seen = read();
    if (seen && seen.key === dealKey && Date.now() - seen.at < SNOOZE_MS) return;
    const t = window.setTimeout(() => {
      // Si la ruleta ya se abrió sola, la oferta espera a la próxima visita.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      (window as unknown as Record<string, boolean>)[POPUP_FLAG] = true;
      write(dealKey);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
    // Solo al entrar: navegar dentro de la tienda no lo vuelve a abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    // Foco en la ventana, no en la X: así no aparece el anillo de foco al abrir.
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-popup-oferta
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Oferta: ${deal.percent}% de descuento en ${deal.productName} talla ${deal.size}`}
    >
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />

      <div ref={boxRef} tabIndex={-1} className="relative w-full max-w-[360px] overflow-hidden outline-none rounded-[8px] border border-line bg-ink-900 text-center text-chalk shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-[16px] text-chalk-dim hover:text-chalk"
        >
          ✕
        </button>

        {deal.imageUrl ? (
          <div className="relative h-44 bg-[#EFEFED]">
            <Image
              src={deal.imageUrl}
              alt={deal.productName}
              fill
              sizes="360px"
              className="object-contain p-4 mix-blend-multiply"
            />
          </div>
        ) : null}

        <div className="px-6 pb-6 pt-5">
          <p className="font-display text-[84px] font-bold leading-[0.9] tracking-tightest text-signal-bad">
            −{deal.percent}%
          </p>
          <p className="mt-3 font-display text-[15px] font-semibold uppercase tracking-wide">
            {deal.productName} · Talla {deal.size}
          </p>
          <p className="mt-1 text-[14px] text-chalk-dim">
            <strong className="text-chalk">{formatCLP(deal.price)}</strong>{' '}
            <s className="text-chalk-faint">{formatCLP(deal.regular)}</s>
          </p>

          <Link
            href={deal.href}
            onClick={() => setOpen(false)}
            className="mt-5 flex h-12 items-center justify-center accent-bg font-display text-[12px] font-bold uppercase tracking-widest transition hover:brightness-110"
          >
            Ver oferta
          </Link>

          {deal.endsAt ? (
            <p className="mt-3 text-[12px] font-semibold text-signal-bad">
              <SaleCountdown endsAt={deal.endsAt} />
            </p>
          ) : (
            <p className="mt-3 text-[12px] text-chalk-faint">Solo esa talla · hasta agotar stock</p>
          )}
        </div>
      </div>
    </div>
  );
}
