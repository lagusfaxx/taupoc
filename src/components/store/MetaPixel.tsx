'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackMetaEvent, trackMetaPageView, type MetaEventData, type MetaEventName } from '@/lib/meta-pixel';

const PixelContext = createContext('');

function PageViews({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const url = `${pathname}${query ? `?${query}` : ''}`;
  const lastPage = useRef('');

  useEffect(() => {
    const key = `${pixelId}:${url}`;
    if (lastPage.current === key) return;
    if (trackMetaPageView(pixelId, url)) lastPage.current = key;
  }, [pixelId, url]);

  return null;
}

export function MetaPixel({ pixelId, children }: { pixelId: string; children: React.ReactNode }) {
  const normalizedId = pixelId.trim();
  return (
    <PixelContext.Provider value={normalizedId}>
      <Suspense fallback={null}><PageViews pixelId={normalizedId} /></Suspense>
      {children}
    </PixelContext.Provider>
  );
}

export function useMetaPixel() {
  const pixelId = useContext(PixelContext);
  return useCallback(
    (event: MetaEventName, data?: MetaEventData, eventId?: string) =>
      trackMetaEvent(pixelId, event, data, eventId),
    [pixelId],
  );
}

/** Un evento por visita; los refrescos de datos y Strict Mode no lo duplican. */
export function MetaEvent({ event, data, eventId, eventKey = '' }: {
  event: MetaEventName;
  data: MetaEventData;
  eventId?: string;
  eventKey?: string;
}) {
  const track = useMetaPixel();
  const pixelId = useContext(PixelContext);
  const pathname = usePathname();
  const lastEvent = useRef('');
  const serialized = JSON.stringify(data);

  useEffect(() => {
    const key = `${pixelId}:${pathname}:${event}:${eventKey}:${eventId ?? ''}`;
    if (lastEvent.current === key) return;
    if (track(event, JSON.parse(serialized), eventId)) lastEvent.current = key;
  }, [track, pixelId, pathname, event, eventKey, eventId, serialized]);

  return null;
}
