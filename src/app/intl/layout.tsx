import { IntlFooter, IntlHeader } from '@/components/intl/Shell';
import { getCartCount } from '@/lib/cart';
import { getSettings } from '@/lib/settings';
import { WhatsAppButton } from '@/components/intl/WhatsAppButton';
import './intl.css';

/**
 * Layout de taupoc.lat. El middleware reescribe cada página de ese dominio
 * bajo /intl; desde taupoc.cl este segmento no existe.
 */
export default async function IntlLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, settings] = await Promise.all([getCartCount(), getSettings()]);
  return (
    <div className="flex min-h-screen flex-col bg-paper text-graphite">
      <IntlHeader cartCount={cartCount} />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <IntlFooter />
      <WhatsAppButton phone={settings.whatsapp} />
    </div>
  );
}
