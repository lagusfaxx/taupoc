'use client';

import { useEffect } from 'react';
import { IconTruck } from '@/components/ui/Icons';
import { useDelivery } from './DeliveryProvider';

export function ProductDeliveryEstimate({
  productId,
  detailed = false,
}: {
  productId: string;
  detailed?: boolean;
}) {
  const { location, register, estimates, loading, locating, setOpen } = useDelivery();
  useEffect(() => register(productId), [register, productId]);
  const result = estimates[productId];
  return (
    <div className={`${detailed ? 'mt-7' : 'mt-3'} text-[13px] leading-relaxed text-graphite-soft`}>
      <div className="flex items-start gap-2">
        <IconTruck className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          {locating ? (
            'Buscando tu localidad…'
          ) : location?.country === 'CL' ? (
            <a href="https://taupoc.cl" className="underline underline-offset-4">
              Para envíos a Chile, visita taupoc.cl
            </a>
          ) : !location || !location.postalCode ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-left underline underline-offset-4"
            >
              {location
                ? 'Completa tu localidad para ver el plazo de entrega'
                : 'Consulta la entrega a tu localidad'}
            </button>
          ) : loading && !result ? (
            'Consultando plazo de entrega…'
          ) : result ? (
            <span>
              Envío a {location.city}: <span className="text-graphite">{result.days} aprox.</span>
            </span>
          ) : (
            <span>Envío a {location.city}: plazo por confirmar.</span>
          )}
          {detailed && result ? (
            <p className="mt-1">
              {result.carrier} · {result.service}. Desde el despacho; el servicio elegido y la
              aduana pueden modificar el plazo.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
