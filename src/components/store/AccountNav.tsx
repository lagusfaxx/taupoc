'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutUser } from '@/actions/auth';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/cuenta', label: 'Resumen' },
  { href: '/cuenta/pedidos', label: 'Mis pedidos' },
  { href: '/cuenta/direcciones', label: 'Direcciones' },
  { href: '/cuenta/datos', label: 'Mis datos' },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mi cuenta" className="border border-line bg-ink-900">
      <ul>
        {LINKS.map((link) => {
          const active = link.href === '/cuenta' ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block border-b border-line-soft px-5 py-3.5 font-display text-[12px] font-semibold uppercase tracking-widest transition-colors',
                  active ? 'accent-text bg-ink-800' : 'text-chalk-dim hover:bg-ink-800 hover:text-chalk',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        <li>
          <form action={logoutUser}>
            <button
              type="submit"
              className="w-full px-5 py-3.5 text-left font-display text-[12px] font-semibold uppercase tracking-widest text-chalk-faint transition-colors hover:text-signal-bad"
            >
              Cerrar sesión
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
