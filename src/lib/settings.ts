import 'server-only';
import { prisma } from './db';

/**
 * Configuración editable desde el panel. Se guarda en la tabla Setting
 * como pares clave/valor JSON, para que el admin no dependa de variables
 * de entorno ni de un despliegue.
 */
export interface SiteSettings {
  // Identidad
  storeName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  instagram: string;
  addressLine: string;

  // Comercial
  freeShippingOver: number | null;
  lowStockThreshold: number;
  installmentsMax: number;
  announcementBar: string;
  announcementActive: boolean;

  // Marketing / analítica
  gaMeasurementId: string;
  metaPixelId: string;
  gtmId: string;

  // Correos
  notifyOrderEmail: boolean;
  notifyAdminNewOrder: boolean;
  notifyLowStock: boolean;

  // Home editable
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroImageUrl: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'TAUPOC Chile',
  tagline: 'Distribuidor oficial en Chile',
  contactEmail: 'hola@taupoc.cl',
  contactPhone: '+56 9 0000 0000',
  whatsapp: '+56900000000',
  instagram: 'taupoc.chile',
  addressLine: 'Santiago, Chile',

  freeShippingOver: 120000,
  lowStockThreshold: 3,
  installmentsMax: 12,
  announcementBar: 'Homologación World Aquatics · Despacho a todo Chile · Stock real de tallas',
  announcementActive: true,

  gaMeasurementId: '',
  metaPixelId: '',
  gtmId: '',

  notifyOrderEmail: true,
  notifyAdminNewOrder: true,
  notifyLowStock: true,

  heroTitle: 'NADA MÁS RÁPIDO.',
  heroSubtitle:
    'Trajes de competición homologados por World Aquatics. Stock real de tallas en Chile, sin esperas de importación.',
  heroCtaLabel: 'Ver R-SKIN',
  heroCtaHref: '/catalogo',
  heroImageUrl: '',
};

const SETTINGS_KEY = 'site';

let cache: { data: SiteSettings; at: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    const stored = (row?.value ?? {}) as Partial<SiteSettings>;
    const data = { ...DEFAULT_SETTINGS, ...stored };
    cache = { data, at: Date.now() };
    return data;
  } catch {
    // La base puede no estar lista durante el build; no es un error fatal.
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next as object },
    update: { value: next as object },
  });
  cache = { data: next, at: Date.now() };
  return next;
}

export function invalidateSettings() {
  cache = null;
}
