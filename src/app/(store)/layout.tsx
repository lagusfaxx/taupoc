import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { MetaPixel } from '@/components/store/MetaPixel';
import { getSettings } from '@/lib/settings';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <MetaPixel pixelId={settings.metaPixelId}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </MetaPixel>
  );
}
