'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MetaEvent } from './MetaPixel';
import type { MetaEventData } from '@/lib/meta-pixel';

export function PaymentTracking({ orderId, approved, pending, data }: {
  orderId: string;
  approved: boolean;
  pending: boolean;
  data: MetaEventData;
}) {
  const router = useRouter();
  const attempts = useRef(0);

  // El retorno de Mercado Pago puede adelantarse al webhook. Volvemos a leer
  // el estado del servidor; los parámetros de la URL nunca acreditan un pago.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      if (attempts.current >= 12) {
        window.clearInterval(timer);
        return;
      }
      attempts.current += 1;
      router.refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pending, router]);

  return approved ? <MetaEvent event="Purchase" data={data} eventId={`purchase:${orderId}`} /> : null;
}
