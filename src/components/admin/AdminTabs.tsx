'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AdminTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  return (
    <div>
      <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors',
              active === tab.id
                ? 'accent-border accent-text'
                : 'border-transparent text-chalk-faint hover:text-chalk',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id}>
          {active === tab.id ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
