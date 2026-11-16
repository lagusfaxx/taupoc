'use client';

import { createContext, useContext } from 'react';

/** Datos comerciales que las tarjetas y la ficha necesitan sin pedirlos de nuevo. */
export interface StorePrefsValue {
  /** Porcentaje de descuento por pagar con transferencia; 0 si no aplica. */
  transferDiscount: number;
  /** Días de las tallas a pedido; 0 si la tienda no vende a pedido. */
  backorderDays: number;
}

const Ctx = createContext<StorePrefsValue>({ transferDiscount: 0, backorderDays: 0 });

export function StorePrefs({ value, children }: { value: StorePrefsValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStorePrefs = () => useContext(Ctx);
