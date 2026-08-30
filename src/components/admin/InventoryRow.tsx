'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { quickAdjustStock } from '@/actions/admin/inventory';
import { cn } from '@/lib/utils';
import { Td, Tr } from './Table';

export interface InventoryRowData {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  colorName: string;
  colorHex: string;
  size: string;
  stock: number;
  threshold: number;
  active: boolean;
}

export function InventoryRow({ row }: { row: InventoryRowData }) {
  const [value, setValue] = useState(String(row.stock));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const dirty = Number(value) !== row.stock;

  function save() {
    if (!dirty) return;
    const formData = new FormData();
    formData.set('variantId', row.variantId);
    formData.set('stock', value);
    startTransition(async () => {
      await quickAdjustStock(null, formData);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    });
  }

  const tone =
    row.stock === 0 ? 'text-signal-bad'
    : row.stock <= row.threshold ? 'text-signal-warn'
    : 'text-chalk';

  return (
    <Tr className={cn(pending && 'opacity-60')}>
      <Td>
        <Link href={`/admin/productos/${row.productId}`} className="text-chalk hover:accent-text">
          {row.productName}
        </Link>
        <p className="font-mono text-[11.5px] text-chalk-faint">{row.sku}</p>
      </Td>
      <Td>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 border border-line-bright" style={{ background: row.colorHex }} aria-hidden />
          {row.colorName}
        </span>
      </Td>
      <Td align="center" className="font-display text-[15px] font-bold text-chalk">{row.size}</Td>
      <Td align="center">
        <span className={cn('font-display text-[15px] font-bold', tone)}>{row.stock}</span>
      </Td>
      <Td align="center" className="text-[12px] text-chalk-faint">{row.threshold}</Td>
      <Td align="right">
        <span className="inline-flex items-center gap-2">
          <label className="sr-only" htmlFor={`inv-${row.variantId}`}>Nuevo stock para {row.sku}</label>
          <input
            id={`inv-${row.variantId}`}
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="h-9 w-20 border border-line bg-ink-900 text-center text-[14px] text-chalk focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className={cn(
              'h-9 px-3 font-display text-[10.5px] font-bold uppercase tracking-widest transition',
              dirty ? 'accent-bg hover:brightness-110' : 'border border-line text-chalk-faint',
              'disabled:cursor-not-allowed',
            )}
          >
            {saved ? '✓' : 'Guardar'}
          </button>
        </span>
      </Td>
    </Tr>
  );
}
