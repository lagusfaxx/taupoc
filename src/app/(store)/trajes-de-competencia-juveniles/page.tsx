import type { Metadata } from 'next';
import { LANDINGS } from '@/lib/landings';
import { LandingPage, landingMetadata } from '@/components/store/LandingPage';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = landingMetadata(LANDINGS.juveniles);

export default function Page() {
  return <LandingPage landing={LANDINGS.juveniles} />;
}
