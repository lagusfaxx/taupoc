import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { getCartCount } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { getNav } from '@/lib/nav';
import { Logo } from '@/components/ui/Logo';
import { IconUser } from '@/components/ui/Icons';
import { CartLink } from './CartLink';
import { MobileNav } from './MobileNav';
import { SearchTrigger } from './SearchTrigger';

export async function Header() {
  const [settings, cartCount, session, nav] = await Promise.all([
    getSettings(),
    getCartCount(),
    getSession(),
    getNav(),
  ]);

  // El umbral de envío gratis se edita en Ajustes; el banner lo toma de ahí
  // para no quedar desfasado.
  const announcement = settings.announcementBar.replace(
    '{envio_gratis}',
    settings.freeShippingOver ? formatCLP(settings.freeShippingOver) : '',
  );

  return (
    <>
      {settings.announcementActive && announcement ? (
        <div className="relative overflow-hidden border-b border-line-soft bg-ink-900">
          <p className="container flex min-h-8 items-center justify-center py-1.5 text-center font-display text-[10.5px] font-medium uppercase tracking-widest text-chalk-dim">
            {announcement}
          </p>
        </div>
      ) : null}

      <header className="sticky top-0 z-50 border-b border-line-soft bg-ink/85 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/70">
        <div className="container flex h-16 items-center gap-4 lg:h-[72px]">
          <MobileNav nav={nav} />

          <Link href="/" aria-label="TAUPOC Chile — inicio" className="shrink-0">
            <Logo src={settings.logoUrl} height={settings.logoHeight} withName={!settings.logoHasName} />
          </Link>

          <nav aria-label="Principal" className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
            {nav.map((item) => (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className="flex h-[72px] items-center px-3.5 font-display text-[12px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:text-chalk"
                >
                  {item.label}
                </Link>
                {item.children ? (
                  <div className="invisible absolute left-0 top-full w-72 translate-y-1 border border-line bg-ink-900 opacity-0 shadow-lift transition-all duration-200 ease-tech group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
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
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <SearchTrigger />

            <Link
              href={session ? '/cuenta' : '/cuenta/ingresar'}
              aria-label={session ? 'Mi cuenta' : 'Ingresar'}
              className="flex h-10 w-10 items-center justify-center text-chalk-dim transition-colors hover:text-chalk"
            >
              <IconUser className="h-[19px] w-[19px]" />
            </Link>

            <CartLink initial={cartCount} />
          </div>
        </div>
      </header>
    </>
  );
}
