import { StorePrefs } from '@/components/store/StorePrefs';
import { Analytics } from '@/components/shared/Analytics';
import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { MetaPixel } from '@/components/store/MetaPixel';
import { getSettings } from '@/lib/settings';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { RouletteWheel } from '@/components/shared/RouletteWheel';
import { rouletteSegments, rouletteVisible } from '@/lib/roulette';
import { getRoulette } from '@/lib/roulette-store';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, roulette] = await Promise.all([getSettings(), getRoulette()]);
  return (
    <MetaPixel pixelId={settings.metaPixelId}>
      <StorePrefs
        value={{
          transferDiscount: settings.transferEnabled ? settings.transferDiscount : 0,
          // Sin número de WhatsApp no hay a dónde pedir la talla.
          backorderDays:
            settings.backorderEnabled && settings.whatsapp.replace(/\D/g, '') ? settings.backorderDays : 0,
        }}
      >
      <Analytics />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
      </StorePrefs>
      <WhatsAppButton phone={settings.whatsapp} message="Hola, les escribo desde taupoc.cl." />
      {rouletteVisible(roulette, 'CL') ? (
        <RouletteWheel
          segments={rouletteSegments(roulette, 'CL')}
          theme="dark"
          title={roulette.title}
          buttonLabel={roulette.buttonLabel}
          autoOpenSeconds={roulette.autoOpenSeconds}
          exitIntent={roulette.exitIntent}
          snoozeDays={roulette.snoozeDays}
        />
      ) : null}
    </MetaPixel>
  );
}
