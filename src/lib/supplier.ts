import 'server-only';
import { prisma } from './db';

/**
 * Stock de fábrica.
 *
 * El proveedor publica su catálogo en una tienda B2B (Shopify). Su listado de
 * productos se puede leer sin iniciar sesión y dice, por cada color y talla,
 * si la fábrica la tiene. No trae cantidades: solo sí o no.
 *
 * Cada producto de la tienda se enlaza a uno del proveedor (`supplierHandle`)
 * y cada color al nombre que usa el proveedor (`supplierColor`), desde
 * Panel → Fábrica. Con eso cada talla queda con `factoryAvailable`, y la
 * tienda ofrece a pedido solo lo que la fábrica dice tener.
 */

const BASE = (process.env.SUPPLIER_B2B_URL || 'https://b2b.taupoc.com').replace(/\/$/, '');
const SETTING_KEY = 'supplierSync';
/** Cada cuánto se vuelve a consultar sola, como mucho. */
const STALE_MS = 30 * 60 * 1000;

export interface SupplierVariant {
  color: string;
  /** Talla numérica ("20"), o `null` si el producto no tiene tallas. */
  size: string | null;
  available: boolean;
}

export interface SupplierProduct {
  handle: string;
  title: string;
  colors: string[];
  variants: SupplierVariant[];
}

interface RawProduct {
  handle: string;
  title: string;
  options: { name: string; position: number }[];
  variants: { option1: string | null; option2: string | null; option3: string | null; available: boolean }[];
}

/** "3XS/20" → "20"; "28" → "28". */
function sizeOf(label: string): string {
  return (label.split('/').pop() ?? label).trim();
}

let cache: { at: number; data: SupplierProduct[] } | null = null;

/** Catálogo del proveedor. Se guarda cinco minutos en memoria. */
export async function fetchSupplierCatalog(force = false): Promise<SupplierProduct[]> {
  if (!force && cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.data;

  const products: SupplierProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`${BASE}/products.json?limit=250&page=${page}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`La tienda del proveedor respondió ${response.status}.`);
    const body = (await response.json()) as { products?: RawProduct[] };
    const batch = body.products ?? [];
    for (const p of batch) {
      const pos = (pattern: RegExp) => p.options.find((o) => pattern.test(o.name))?.position ?? 0;
      const colorPos = pos(/colou?r/i);
      const sizePos = pos(/size|talla/i);
      const pick = (v: RawProduct['variants'][number], position: number) =>
        position === 1 ? v.option1 : position === 2 ? v.option2 : position === 3 ? v.option3 : null;
      const variants = p.variants.map((v) => {
        const size = pick(v, sizePos);
        return {
          color: (pick(v, colorPos) ?? '').trim(),
          size: size ? sizeOf(size) : null,
          available: Boolean(v.available),
        };
      });
      products.push({
        handle: p.handle,
        title: p.title,
        colors: [...new Set(variants.map((v) => v.color).filter(Boolean))],
        variants,
      });
    }
    if (batch.length < 250) break;
  }
  cache = { at: Date.now(), data: products };
  return products;
}

export interface SupplierSyncStatus {
  at: string | null;
  linkedColors: number;
  available: number;
  unavailable: number;
  error: string | null;
}

const EMPTY_STATUS: SupplierSyncStatus = { at: null, linkedColors: 0, available: 0, unavailable: 0, error: null };

export async function getSupplierSyncStatus(): Promise<SupplierSyncStatus> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  return { ...EMPTY_STATUS, ...((row?.value ?? {}) as Partial<SupplierSyncStatus>) };
}

async function saveStatus(status: SupplierSyncStatus) {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: status as object },
    update: { value: status as object },
  });
}

/**
 * Actualiza `factoryAvailable` de todas las tallas enlazadas.
 *
 * Si el proveedor no responde no se toca nada: es mejor seguir con el último
 * dato conocido que dejar toda la tienda como "sin stock en fábrica".
 */
export async function syncFactoryStock(): Promise<SupplierSyncStatus> {
  let catalog: SupplierProduct[];
  try {
    catalog = await fetchSupplierCatalog(true);
  } catch (error) {
    const previous = await getSupplierSyncStatus();
    const status = { ...previous, error: error instanceof Error ? error.message : 'No se pudo consultar al proveedor.' };
    await saveStatus(status);
    return status;
  }
  const byHandle = new Map(catalog.map((p) => [p.handle, p]));

  const products = await prisma.product.findMany({
    select: {
      supplierHandle: true,
      colors: { select: { supplierColor: true, variants: { select: { id: true, size: true } } } },
    },
  });

  const yes: string[] = [];
  const no: string[] = [];
  const unknown: string[] = [];
  let linkedColors = 0;

  for (const product of products) {
    const supplier = product.supplierHandle ? byHandle.get(product.supplierHandle) : undefined;
    for (const color of product.colors) {
      const rows = supplier && color.supplierColor
        ? supplier.variants.filter((v) => v.color === color.supplierColor)
        : [];
      if (rows.length === 0) {
        // Sin enlace, o el proveedor ya no lista ese color: no se sabe.
        unknown.push(...color.variants.map((v) => v.id));
        continue;
      }
      linkedColors++;
      for (const variant of color.variants) {
        const match = rows.find((r) => r.size == null || r.size === variant.size);
        // Una talla que el proveedor no lista para ese color no se fabrica.
        (match?.available ? yes : no).push(variant.id);
      }
    }
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.variant.updateMany({ where: { id: { in: yes } }, data: { factoryAvailable: true, factoryCheckedAt: now } }),
    prisma.variant.updateMany({ where: { id: { in: no } }, data: { factoryAvailable: false, factoryCheckedAt: now } }),
    prisma.variant.updateMany({
      where: { id: { in: unknown }, factoryAvailable: { not: null } },
      data: { factoryAvailable: null, factoryCheckedAt: null },
    }),
  ]);

  const status: SupplierSyncStatus = {
    at: now.toISOString(),
    linkedColors,
    available: yes.length,
    unavailable: no.length,
    error: null,
  };
  await saveStatus(status);
  return status;
}

let lastAttempt = 0;

/**
 * Vuelve a consultar al proveedor si el dato tiene más de media hora. No
 * espera el resultado: la página que lo dispara se sirve con lo que hay, y la
 * siguiente visita ya ve el dato nuevo. Así funciona sin tarea programada.
 */
export function refreshFactoryStockIfStale(): void {
  if (Date.now() - lastAttempt < STALE_MS) return;
  lastAttempt = Date.now();
  void (async () => {
    const status = await getSupplierSyncStatus();
    if (status.linkedColors === 0 && !status.at) {
      // Nada enlazado todavía: no hay qué consultar.
      const linked = await prisma.product.count({ where: { supplierHandle: { not: null } } });
      if (linked === 0) return;
    }
    if (status.at && Date.now() - new Date(status.at).getTime() < STALE_MS) return;
    await syncFactoryStock();
  })().catch((error) => console.error('[fabrica:sync]', error));
}

const NAME_HINTS: [RegExp, RegExp][] = [
  [/negro/i, /^black/i],
  [/blanco/i, /^white/i],
  [/naranja/i, /^orange/i],
  [/amarillo/i, /^yellow/i],
  [/royal/i, /^royal/i],
  [/army/i, /^army/i],
  [/rosad/i, /^pink/i],
  [/p[uú]rpura|morado/i, /^purple/i],
  [/rojo/i, /^red/i],
  // El proveedor llama "Citycape" a su azul marino 60289.
  [/marino/i, /^citycape/i],
];

/**
 * Propone el color del proveedor que corresponde a uno de la tienda: primero
 * por código de colorway; si no, por nombre, y cuando el proveedor tiene dos
 * del mismo nombre ("Red/0102black", "Red/0524yellow") decide el código del
 * vivo.
 */
export function suggestSupplierColor(
  color: { name: string; code: string | null; stripCode?: string | null },
  supplierColors: string[],
): string | null {
  const digits = (s: string) => s.replace(/\D/g, '');
  const code = color.code ? digits(color.code) : '';
  if (code.length >= 4) {
    const byCode = supplierColors.find((s) => digits(s.split('/').slice(1).join('/')) === code);
    if (byCode) return byCode;
  }
  for (const [ours, theirs] of NAME_HINTS) {
    if (!ours.test(color.name)) continue;
    const matches = supplierColors.filter((s) => theirs.test(s));
    if (matches.length === 1) return matches[0];
    const strip = color.stripCode ? digits(color.stripCode) : '';
    if (matches.length > 1 && strip.length >= 3) {
      const byStrip = matches.filter((s) => digits(s).includes(strip));
      if (byStrip.length === 1) return byStrip[0];
    }
  }
  return null;
}

/** Propone el producto del proveedor por nombre. */
export function suggestSupplierHandle(name: string, catalog: SupplierProduct[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return catalog.find((p) => norm(p.title) === norm(name))?.handle ?? null;
}
