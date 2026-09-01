'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AdminTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function AdminTabs({
  tabs,
  keepMounted = false,
}: {
  tabs: AdminTab[];
  /**
   * Mantiene en el DOM el contenido de las pestañas ocultas.
   *
   * Hace falta cuando todas viven dentro de un mismo `<form>`: un campo que
   * no está montado no viaja en el envío, así que guardar desde una pestaña
   * perdía lo de las demás. Queda apagado por omisión porque hay pestañas
   * caras de montar —galerías, matrices de variantes— que solo contienen
   * formularios independientes y no ganan nada con estar siempre presentes.
   */
  keepMounted?: boolean;
}) {
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
          {keepMounted || active === tab.id ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
