'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AccordionItem {
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(items.map((item, i) => [i, Boolean(item.defaultOpen)])),
  );

  return (
    <div className="border-t border-line">
      {items.map((item, i) => {
        const isOpen = open[i];
        return (
          <div key={item.title} className="border-b border-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="font-display text-[13px] font-semibold uppercase tracking-widest text-chalk">
                  {item.title}
                </span>
                <span
                  className={cn(
                    'relative h-3.5 w-3.5 shrink-0 text-chalk-faint transition-transform duration-300 ease-tech',
                    isOpen && 'rotate-45',
                  )}
                  aria-hidden
                >
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                </span>
              </button>
            </h3>
            <div
              className={cn(
                'grid transition-all duration-300 ease-tech',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-5">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
