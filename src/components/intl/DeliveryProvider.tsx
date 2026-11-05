'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  deliveryLocationSchema,
  type DeliveryEstimate,
  type DeliveryLocation,
} from '@/lib/delivery-location';
import { locateDelivery, LOCATION_SEARCH_ENABLED } from '@/lib/mapbox-location';

const STORAGE = 'taupoc-intl-delivery';
const ASKED = 'taupoc-intl-location-asked';
interface DeliveryContextValue {
  location: DeliveryLocation | null;
  locating: boolean;
  message: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  choose: (location: DeliveryLocation) => void;
  locate: () => void;
  register: (id: string) => () => void;
  estimates: Record<string, DeliveryEstimate | null>;
  loading: boolean;
}
const DeliveryContext = createContext<DeliveryContextValue | null>(null);

export function useDelivery() {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error('DeliveryProvider is missing.');
  return context;
}

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpenState] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [estimates, setEstimates] = useState<Record<string, DeliveryEstimate | null>>({});
  const [loading, setLoading] = useState(false);
  const counts = useRef(new Map<string, number>());
  const started = useRef(false);
  const generation = useRef(0);
  const deliveryGeneration = useRef(0);
  const geocoder = useRef<AbortController | null>(null);

  const setOpen = useCallback((value: boolean) => {
    if (value) {
      generation.current++;
      geocoder.current?.abort();
      setLocating(false);
    }
    setOpenState(value);
  }, []);

  const choose = useCallback((next: DeliveryLocation) => {
    generation.current++;
    deliveryGeneration.current++;
    geocoder.current?.abort();
    setLocating(false);
    setLocation(next);
    setEstimates({});
    setMessage('');
    setOpenState(false);
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {}
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation || !LOCATION_SEARCH_ENABLED) {
      setMessage('Elige tu localidad para consultar la entrega.');
      return;
    }
    const current = ++generation.current;
    geocoder.current?.abort();
    setLocating(true);
    setMessage('');
    try {
      sessionStorage.setItem(ASKED, '1');
    } catch {}
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (current !== generation.current) return;
        const controller = new AbortController();
        geocoder.current = controller;
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const found = await locateDelivery(
            position.coords.latitude,
            position.coords.longitude,
            controller.signal,
          );
          if (current !== generation.current) return;
          if (found) choose(found);
          else setMessage('No pudimos identificar tu localidad. Puedes elegirla manualmente.');
        } catch {
          if (current === generation.current)
            setMessage('No pudimos consultar tu ubicación. Puedes elegir tu localidad.');
        } finally {
          clearTimeout(timeout);
          if (current === generation.current) setLocating(false);
        }
      },
      () => {
        if (current !== generation.current) return;
        setLocating(false);
        setMessage('Puedes elegir tu localidad para consultar la entrega.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [choose]);

  // El layout se monta en cualquier página de .lat. No vuelve a pedir permiso al navegar o recargar.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let asked = false;
    try {
      const saved = deliveryLocationSchema.safeParse(
        JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null'),
      );
      if (saved.success) setLocation(saved.data);
      asked = sessionStorage.getItem(ASKED) === '1';
    } catch {}
    if (!asked) locate();
  }, [locate]);

  const register = useCallback((id: string) => {
    counts.current.set(id, (counts.current.get(id) ?? 0) + 1);
    setProducts([...counts.current.keys()].sort());
    return () => {
      const n = (counts.current.get(id) ?? 1) - 1;
      if (n === 0) counts.current.delete(id);
      else counts.current.set(id, n);
      setProducts([...counts.current.keys()].sort());
    };
  }, []);
  const productKey = products.join(',');
  useEffect(() => {
    if (!location || location.country === 'CL' || location.postalCode.length < 2 || !productKey) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const requestGeneration = ++deliveryGeneration.current;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    const timer = setTimeout(async () => {
      deadline = setTimeout(() => controller.abort(), 15_000);
      try {
        const ids = productKey.split(',');
        const batches = [];
        for (let i = 0; i < ids.length; i += 40) batches.push(ids.slice(i, i + 40));
        const results = await Promise.all(
          batches.map(async (productIds) => {
            const response = await fetch('/api/intl/entrega', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds, destination: location }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error('Delivery lookup unavailable.');
            return (await response.json()).estimates as Record<string, DeliveryEstimate | null>;
          }),
        );
        if (!controller.signal.aborted && requestGeneration === deliveryGeneration.current)
          setEstimates(Object.assign({}, ...results));
      } catch {
        // No se inventa un plazo cuando la paquetería o la conexión no responden.
      } finally {
        clearTimeout(deadline);
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [location, productKey]);

  return (
    <DeliveryContext.Provider
      value={{
        location,
        locating,
        message,
        open,
        setOpen,
        choose,
        locate,
        register,
        estimates,
        loading,
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
}
