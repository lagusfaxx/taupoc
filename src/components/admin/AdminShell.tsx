'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logoutUser } from '@/actions/auth';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/ui/Logo';
import {
  IconBox,
  IconSpark, IconChart, IconClose, IconDoc, IconMenu, IconSettings,
  IconTag, IconTruck, IconUsers, IconExternal,
} from '@/components/ui/Icons';

interface NavGroup {
  title: string;
  items: { href: string; label: string; icon: typeof IconBox; badge?: number }[];
}

export function AdminShell({
  children,
  user,
  logoUrl,
  pendingOrders,
  newQuotes,
  lowStock,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  logoUrl?: string;
  pendingOrders: number;
  newQuotes: number;
  lowStock: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const groups: NavGroup[] = [
    {
      title: 'Ventas',
      items: [
        { href: '/admin', label: 'Resumen', icon: IconChart },
        { href: '/admin/pedidos', label: 'Pedidos', icon: IconBox, badge: pendingOrders },
        { href: '/admin/clientes', label: 'Clientes', icon: IconUsers },
        { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: IconDoc, badge: newQuotes },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { href: '/admin/productos', label: 'Productos', icon: IconTag },
        { href: '/admin/inventario', label: 'Inventario', icon: IconBox, badge: lowStock },
        { href: '/admin/cupones', label: 'Cupones', icon: IconTag },
      ],
    },
    {
      title: 'Contenido',
      items: [
        { href: '/admin/inicio', label: 'Inicio', icon: IconSpark },
        { href: '/admin/blog', label: 'Blog', icon: IconDoc },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { href: '/admin/envios', label: 'Envíos', icon: IconTruck },
        { href: '/admin/reportes', label: 'Reportes', icon: IconChart },
        { href: '/admin/configuracion', label: 'Ajustes', icon: IconSettings },
      ],
    },
  ];

  const nav = (
    <nav aria-label="Panel" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-6 w-auto max-w-[150px] object-contain" />
        ) : (
          <LogoMark className="h-6 w-auto accent-text" />
        )}
        <div className="leading-none">
          {logoUrl ? null : (
            <p className="font-display text-[13px] font-extrabold tracking-[0.2em] text-chalk">
              TAUPOC
            </p>
          )}
          <p className="mt-[3px] font-display text-[8px] font-semibold tracking-[0.3em] text-chalk-faint">
            PANEL
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className="ml-auto text-chalk-faint lg:hidden"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-1.5 px-5 font-display text-[9.5px] uppercase tracking-mega text-chalk-faint/70">
              {group.title}
            </p>
            <ul>
              {group.items.map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 px-5 py-2.5 text-[13.5px] transition-colors',
                        active
                          ? 'bg-ink-800 text-chalk'
                          : 'text-chalk-dim hover:bg-ink-800/60 hover:text-chalk',
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-0 h-full w-[2px] accent-bg" aria-hidden />
                      ) : null}
                      <item.icon className={cn('h-4 w-4 shrink-0', active && 'accent-text')} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="min-w-[20px] accent-bg px-1.5 py-0.5 text-center font-display text-[10px] font-bold leading-none">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-4">
        <Link
          href="/"
          target="_blank"
          className="mb-3 flex items-center gap-2 text-[12.5px] text-chalk-faint hover:text-chalk"
        >
          <IconExternal className="h-3.5 w-3.5" />
          Ver la tienda
        </Link>
        <p className="truncate text-[13px] text-chalk">{user.name}</p>
        <p className="truncate text-[11.5px] text-chalk-faint">{user.email}</p>
        <form action={logoutUser} className="mt-2.5">
          <button
            type="submit"
            className="font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-faint hover:text-signal-bad"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-ink-900 lg:block">
        {nav}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="flex h-9 w-9 items-center justify-center text-chalk"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <LogoMark className="h-5 w-auto accent-text" />
          <span className="font-display text-[12px] font-bold tracking-[0.2em] text-chalk">
            TAUPOC · PANEL
          </span>
        </header>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 left-0 w-[86%] max-w-[280px] border-r border-line bg-ink-900">
              {nav}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
