'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isMetaPixelId, trackMetaEvent, type MetaEventData, type MetaEventName } from '@/lib/meta-pixel';

const PixelContext = createContext('');

function PageViews({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;
  const lastPage = useRef('');

  useEffect(() => {
    const key = `${pixelId}:${url}`;
    if (lastPage.current === key) return;
    if (trackMetaEvent(pixelId, 'PageView')) lastPage.current = key;
  }, [pixelId, url]);

  return null;
}

export function MetaPixel({ pixelId, children }: { pixelId: string; children: React.ReactNode }) {
  return (
    <PixelContext.Provider value={pixelId}>
      <Suspense fallback={null}><PageViews pixelId={pixelId} /></Suspense>
      {children}
      {isMetaPixelId(pixelId) ? (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: 'none' }} alt=""
            src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
        </noscript>
      ) : null}
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
  const pathname = usePathname();
  const lastEvent = useRef('');
  const serialized = JSON.stringify(data);

  useEffect(() => {
    const key = `${pathname}:${event}:${eventKey}:${eventId ?? ''}`;
    if (lastEvent.current === key) return;
    if (track(event, JSON.parse(serialized), eventId)) lastEvent.current = key;
  }, [track, pathname, event, eventKey, eventId, serialized]);

  return null;
}
