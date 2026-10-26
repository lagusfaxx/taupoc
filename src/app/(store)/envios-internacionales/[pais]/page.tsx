import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countryBySlug, countryLanding } from '@/lib/international';
import { LandingPage, landingMetadata } from '@/components/store/LandingPage';

// El encabezado lee el cookie del carrito: la página se arma por solicitud.
export const dynamic = 'force-dynamic';

type Params = Promise<{ pais: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const country = countryBySlug((await params).pais);
  if (!country) return {};
  const metadata = landingMetadata(countryLanding(country));
  // La página está escrita para ese país: se declara su variante regional.
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      languages: { [`es-${country.code}`]: metadata.alternates?.canonical as string },
    },
    openGraph: { ...metadata.openGraph, locale: `es_${country.code}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const country = countryBySlug((await params).pais);
  if (!country) notFound();
  return <LandingPage landing={countryLanding(country)} />;
}
