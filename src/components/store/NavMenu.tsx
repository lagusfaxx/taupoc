'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';

/**
 * La navegación de escritorio, con sus desplegables.
 *
 * El desplegable se abría solo con `:hover`, que en una pantalla táctil no
 * existe: el navegador lo emula con el primer toque y recién el segundo
 * activaba el enlace. En un notebook táctil o en un iPad eso se sentía como
 * "hay que apretar dos veces todo".
 *
 * Con el puntero fino manda el hover, igual que antes. Con puntero grueso
 * —dedo— el primer toque en un enlace que tiene desplegable lo abre en vez de
 * navegar, y el segundo ya entra: el visitante ve las opciones antes de
 * elegir, que es lo que el hover hacía en el escritorio.
 */
export function NavMenu({ nav }: { nav: NavItem[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => setAbierto(null), [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  return (
    <nav aria-label="Principal" className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
      {nav.map((item, i) => {
        const clave = `${item.href}-${i}`;
        const desplegado = abierto === clave;

        return (
          <div
            key={clave}
            className="group relative"
            onMouseLeave={() => setAbierto((actual) => (actual === clave ? null : actual))}
          >
            <Link
              href={item.href}
              aria-expanded={item.children ? desplegado : undefined}
              onClick={(event) => {
                if (!item.children) return;
                // Solo donde no hay hover de verdad. Con mouse esto no corre y
                // el enlace navega al primer clic, como siempre.
                const tactil =
                  typeof window !== 'undefined' &&
                  window.matchMedia('(hover: none)').matches;
                if (tactil && !desplegado) {
                  event.preventDefault();
                  setAbierto(clave);
                }
              }}
              className="flex h-[72px] items-center px-3.5 font-display text-[12px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:text-chalk"
            >
              {item.label}
            </Link>

            {item.children ? (
              <div
                className={cn(
                  'absolute left-0 top-full w-72 border border-line bg-ink-900 shadow-lift transition-all duration-200 ease-tech',
                  'group-hover:visible group-hover:translate-y-0 group-hover:opacity-100',
                  'group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100',
                  desplegado ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0',
                )}
              >
                {item.children.map((child) => (
                  <Link
                    key={child.href + child.label}
                    href={child.href}
                    className="block border-b border-line-soft px-4 py-3 last:border-0 hover:bg-ink-800"
                  >
                    <span className="block font-display text-[12px] font-semibold uppercase tracking-wide text-chalk">
                      {child.label}
                    </span>
                    {child.note ? (
                      <span className="mt-0.5 block text-[12px] text-chalk-faint">{child.note}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
