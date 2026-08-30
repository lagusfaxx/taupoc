'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { saveSettings } from '@/lib/settings';
import { parseCLP } from '@/lib/money';
import type { AdminState } from './products';

const schema = z.object({
  storeName: z.string().min(2, 'Ingresa el nombre de la tienda.'),
  tagline: z.string().optional(),
  contactEmail: z.string().email('Ingresa un correo válido.'),
  contactPhone: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  addressLine: z.string().optional(),

  freeShippingOver: z.string().optional(),
  lowStockThreshold: z.string().optional(),
  installmentsMax: z.string().optional(),
  announcementBar: z.string().optional(),
  announcementActive: z.string().optional(),

  gaMeasurementId: z.string().optional(),
  metaPixelId: z.string().optional(),
  gtmId: z.string().optional(),

  notifyOrderEmail: z.string().optional(),
  notifyAdminNewOrder: z.string().optional(),
  notifyLowStock: z.string().optional(),

});

export async function updateSettings(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;

  const freeShipping = (d.freeShippingOver ?? '').trim();

  await saveSettings({
    storeName: d.storeName.trim(),
    tagline: d.tagline?.trim() ?? '',
    contactEmail: d.contactEmail.trim(),
    contactPhone: d.contactPhone?.trim() ?? '',
    whatsapp: d.whatsapp?.trim() ?? '',
    instagram: d.instagram?.trim().replace('@', '') ?? '',
    addressLine: d.addressLine?.trim() ?? '',

    freeShippingOver: freeShipping ? parseCLP(freeShipping) : null,
    lowStockThreshold: Math.max(0, Number(d.lowStockThreshold ?? 3) || 3),
    installmentsMax: Math.min(24, Math.max(1, Number(d.installmentsMax ?? 12) || 12)),
    announcementBar: d.announcementBar?.trim() ?? '',
    announcementActive: d.announcementActive === 'on',

    gaMeasurementId: d.gaMeasurementId?.trim() ?? '',
    metaPixelId: d.metaPixelId?.trim() ?? '',
    gtmId: d.gtmId?.trim() ?? '',

    notifyOrderEmail: d.notifyOrderEmail === 'on',
    notifyAdminNewOrder: d.notifyAdminNewOrder === 'on',
    notifyLowStock: d.notifyLowStock === 'on',
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/configuracion');

  return { ok: true, message: 'Configuración guardada. Los cambios ya están en la tienda.' };
}
