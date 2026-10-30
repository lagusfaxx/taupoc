import { IntlFooter, IntlHeader } from '@/components/intl/Shell';
import './intl.css';

/**
 * Layout de taupoc.lat. El middleware reescribe cada página de ese dominio
 * bajo /intl; desde taupoc.cl este segmento no existe.
 */
export default function IntlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-graphite">
      <IntlHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <IntlFooter />
    </div>
  );
}
