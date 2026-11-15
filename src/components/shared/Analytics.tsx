'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track, type TrackType } from '@/lib/track';

/** Registra cada página vista. Va una vez en el layout de la tienda. */
export function Analytics() {
  const pathname = usePathname();
  const last = useRef('');

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    track('PAGE_VIEW');
  }, [pathname]);

  return null;
}

/** Un evento puntual del embudo: ficha vista, llegada al pago o pedido hecho. */
export function TrackEvent({
  type,
  productId,
  orderNumber,
}: {
  type: Exclude<TrackType, 'PAGE_VIEW'>;
  productId?: string;
  orderNumber?: string;
}) {
  const sent = useRef('');

  useEffect(() => {
    const key = `${type}:${productId ?? ''}:${orderNumber ?? ''}`;
    if (sent.current === key) return;
    sent.current = key;
    track(type, { productId, orderNumber });
  }, [type, productId, orderNumber]);

  return null;
}
