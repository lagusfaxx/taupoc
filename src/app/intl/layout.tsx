import { IntlFooter, IntlHeader } from '@/components/intl/Shell';
import { getCartCount } from '@/lib/cart';
import { getSettings } from '@/lib/settings';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { RouletteWheel } from '@/components/shared/RouletteWheel';
import { rouletteSegments } from '@/lib/roulette';
import { IntlCartDrawer } from '@/components/intl/CartDrawer';
import { DeliveryLocationControl } from '@/components/intl/DeliveryLocation';
import { jsonLd } from '@/lib/seo';
import { intlUrl } from '@/lib/intl-seo';
import './intl.css';

/**
 * Layout de taupoc.lat. El middleware reescribe cada página de ese dominio
 * bajo /intl; desde taupoc.cl este segmento no existe.
 */
export default async function IntlLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, settings] = await Promise.all([getCartCount(), getSettings()]);
  const orgLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': intlUrl('/#org'),
        name: 'TAUPOC',
        url: intlUrl('/'),
        ...(settings.intlLogoUrl || settings.logoUrl
          ? { logo: intlUrl(settings.intlLogoUrl || settings.logoUrl) }
          : {}),
        ...(settings.instagram
          ? { sameAs: [`https://instagram.com/${settings.instagram.replace('@', '')}`] }
          : {}),
        ...(settings.contactEmail
          ? {
              contactPoint: {
                '@type': 'ContactPoint',
                email: settings.contactEmail,
                contactType: 'customer service',
                availableLanguage: 'es',
              },
            }
          : {}),
      },
      {
        '@type': 'WebSite',
        '@id': intlUrl('/#web'),
        name: 'TAUPOC',
        url: intlUrl('/'),
        inLanguage: 'es-419',
        publisher: { '@id': intlUrl('/#org') },
      },
    ],
  };
  return (
    <div className="flex min-h-screen flex-col bg-paper text-graphite">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />
      <IntlHeader
        cartCount={cartCount}
        logo={
          settings.intlLogoUrl
            ? {
                src: settings.intlLogoUrl,
                height: settings.logoHeight,
                darken: false,
                hasName: settings.intlLogoHasName,
              }
            : settings.logoUrl
              ? {
                  src: settings.logoUrl,
                  height: settings.logoHeight,
                  darken: true,
                  hasName: settings.logoHasName,
                }
              : null
        }
      />
      <DeliveryLocationControl />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <IntlFooter instagram={settings.instagram} contactEmail={settings.contactEmail} />
      <WhatsAppButton phone={settings.whatsapp} message="Hola, les escribo desde taupoc.lat." />
      <IntlCartDrawer />
      {settings.rouletteEnabled ? <RouletteWheel segments={rouletteSegments('INTL')} theme="light" /> : null}
    </div>
  );
}
