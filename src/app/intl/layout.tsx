import { IntlFooter, IntlHeader } from '@/components/intl/Shell';
import { getCartCount } from '@/lib/cart';
import { getSettings } from '@/lib/settings';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import './intl.css';

/**
 * Layout de taupoc.lat. El middleware reescribe cada página de ese dominio
 * bajo /intl; desde taupoc.cl este segmento no existe.
 */
export default async function IntlLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, settings] = await Promise.all([getCartCount(), getSettings()]);
  return (
    <div className="flex min-h-screen flex-col bg-paper text-graphite">
      <IntlHeader
        cartCount={cartCount}
        logo={
          settings.intlLogoUrl
            ? { src: settings.intlLogoUrl, height: settings.logoHeight, darken: false, hasName: settings.intlLogoHasName }
            : settings.logoUrl
              ? { src: settings.logoUrl, height: settings.logoHeight, darken: true, hasName: settings.logoHasName }
              : null
        }
      />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <IntlFooter />
      <WhatsAppButton phone={settings.whatsapp} message="Hola, les escribo desde taupoc.lat." />
    </div>
  );
}
