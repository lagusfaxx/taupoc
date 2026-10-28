import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { getGiveaway } from '@/lib/giveaway-store';
import { formatChileShort, isRevealed } from '@/lib/giveaway';
import { formatCLP } from '@/lib/money';
import { getCartCount } from '@/lib/cart';
import { getSession } from '@/lib/auth';
import { getNav } from '@/lib/nav';
import { Logo } from '@/components/ui/Logo';
import { IconUser } from '@/components/ui/Icons';
import { CartLink } from './CartLink';
import { MobileNav } from './MobileNav';
import { NavMenu } from './NavMenu';
import { SearchTrigger } from './SearchTrigger';

export async function Header() {
  const [settings, cartCount, session, nav, giveaway] = await Promise.all([
    getSettings(),
    getCartCount(),
    getSession(),
    getNav(),
    getGiveaway(),
  ]);

  // El umbral de envío gratis se edita en Ajustes; el banner lo toma de ahí
  // para no quedar desfasado.
  const announcement = settings.announcementBar.replace(
    '{envio_gratis}',
    settings.freeShippingOver ? formatCLP(settings.freeShippingOver) : '',
  );

  return (
    <>
      {giveaway.active && giveaway.showBanner ? (
        <Link
          href="/sorteo"
          className="group block accent-bg text-center font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110"
        >
          <span className="container flex min-h-9 items-center justify-center gap-2 py-2">
            {giveaway.title} ·{' '}
            {isRevealed(giveaway) ? 'Ver ganador' : `Ganador en vivo · ${formatChileShort(giveaway.revealAt)}`}
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </Link>
      ) : null}
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

          <NavMenu nav={nav} />


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
