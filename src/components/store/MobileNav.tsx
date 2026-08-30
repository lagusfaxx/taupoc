'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NavItem } from './Header';
import { IconClose, IconMenu } from '@/components/ui/Icons';
import { Logo } from '@/components/ui/Logo';

export function MobileNav({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        className="-ml-2 flex h-10 w-10 items-center justify-center text-chalk lg:hidden"
      >
        <IconMenu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav
            aria-label="Menú principal"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-line bg-ink-900 animate-rise-in"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-10 w-10 items-center justify-center text-chalk-dim"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {nav.map((item) => (
                <div key={item.href} className="border-b border-line-soft">
                  <Link
                    href={item.href}
                    className="block px-5 py-4 font-display text-sm font-semibold uppercase tracking-widest text-chalk"
                  >
                    {item.label}
                  </Link>
                  {item.children ? (
                    <div className="pb-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.href + child.label}
                          href={child.href}
                          className="block py-2.5 pl-8 pr-5 text-[14px] text-chalk-dim"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="border-t border-line px-5 py-4">
              <Link
                href="/cuenta"
                className="font-display text-[12px] font-semibold uppercase tracking-widest accent-text"
              >
                Mi cuenta →
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
