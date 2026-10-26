import type { Metadata } from 'next';
import { INTERNATIONAL_LANDING } from '@/lib/international';
import { LandingPage, landingMetadata } from '@/components/store/LandingPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = landingMetadata(INTERNATIONAL_LANDING);

export default function Page() {
  return <LandingPage landing={INTERNATIONAL_LANDING} />;
}
