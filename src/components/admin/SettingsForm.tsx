'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateSettings } from '@/actions/admin/settings';
import type { AdminState } from '@/actions/admin/products';
import type { SiteSettings } from '@/lib/settings';
import { formatNumber } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { AdminTabs } from './AdminTabs';
import { Checkbox, Input, Textarea } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar configuración'}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateSettings, null);

  return (
    <form action={action}>
      {state ? (
        <p
          role="status"
          className={cn(
            'mb-5 border px-3.5 py-2.5 text-[13.5px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <AdminTabs
        tabs={[
          {
            id: 'tienda',
            label: 'Tienda',
            content: (
              <div className="grid gap-5 xl:grid-cols-2">
                <Card title="Identidad">
                  <div className="space-y-4">
                    <Input label="Nombre de la tienda" name="storeName" required defaultValue={settings.storeName} />
                    <Input label="Bajada" name="tagline" defaultValue={settings.tagline} />
                    <Input label="Correo de contacto" name="contactEmail" type="email" required defaultValue={settings.contactEmail} />
                    <Input label="Teléfono" name="contactPhone" defaultValue={settings.contactPhone} />
                    <Input
                      label="WhatsApp"
                      name="whatsapp"
                      defaultValue={settings.whatsapp}
                      placeholder="+56955555555"
                      help="Con código de país, sin espacios."
                    />
                    <Input label="Instagram" name="instagram" defaultValue={settings.instagram} placeholder="taupoc.chile" />
                    <Input label="Dirección" name="addressLine" defaultValue={settings.addressLine} />
                  </div>
                </Card>

                <Card title="Comercial">
                  <div className="space-y-4">
                    <Input
                      label="Envío gratis sobre"
                      name="freeShippingOver"
                      defaultValue={settings.freeShippingOver ? formatNumber(settings.freeShippingOver) : ''}
                      placeholder="150.000"
                      help="Déjalo vacío para desactivar el envío gratis general."
                    />
                    <Input
                      label="Umbral de stock bajo"
                      name="lowStockThreshold"
                      type="number"
                      defaultValue={String(settings.lowStockThreshold)}
                      help="Cuando un SKU baja de esta cantidad aparece en las alertas."
                    />
                    <Input
                      label="Cuotas máximas"
                      name="installmentsMax"
                      type="number"
                      defaultValue={String(settings.installmentsMax)}
                      help="Se muestra en la ficha y se envía a Mercado Pago."
                    />
                    <Textarea
                      label="Barra de anuncio"
                      name="announcementBar"
                      rows={2}
                      defaultValue={settings.announcementBar}
                      help="La franja de texto sobre el menú."
                    />
                    <Checkbox
                      name="announcementActive"
                      defaultChecked={settings.announcementActive}
                      label="Mostrar la barra de anuncio"
                    />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: 'analitica',
            label: 'Analítica',
            content: (
              <Card
                title="Google Analytics y Meta Pixel"
                description="Si dejas un campo vacío, ese script no se carga en la tienda."
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <Input
                    label="Google Analytics 4"
                    name="gaMeasurementId"
                    defaultValue={settings.gaMeasurementId}
                    placeholder="G-XXXXXXXXXX"
                    help="ID de medición de GA4."
                  />
                  <Input
                    label="Google Tag Manager"
                    name="gtmId"
                    defaultValue={settings.gtmId}
                    placeholder="GTM-XXXXXXX"
                  />
                  <Input
                    label="Meta Pixel"
                    name="metaPixelId"
                    defaultValue={settings.metaPixelId}
                    placeholder="123456789012345"
                    help="ID del píxel de Facebook e Instagram."
                  />
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-faint">
                  Los scripts se cargan después de la interacción para no afectar la velocidad de carga.
                  Recuerda declarar el uso de cookies en la política de privacidad.
                </p>
              </Card>
            ),
          },
          {
            id: 'correos',
            label: 'Correos',
            content: (
              <Card
                title="Notificaciones por correo"
                description="Los datos del servidor SMTP se configuran por variables de entorno."
              >
                <div className="space-y-4">
                  <Checkbox
                    name="notifyOrderEmail"
                    defaultChecked={settings.notifyOrderEmail}
                    label="Enviar al cliente los correos de pedido recibido, pago confirmado y despacho"
                  />
                  <Checkbox
                    name="notifyAdminNewOrder"
                    defaultChecked={settings.notifyAdminNewOrder}
                    label="Avisarnos por correo cada vez que se acredita un pago"
                  />
                  <Checkbox
                    name="notifyLowStock"
                    defaultChecked={settings.notifyLowStock}
                    label="Avisarnos cuando haya SKU bajo el umbral de stock (máximo una vez cada 12 horas)"
                  />
                </div>
                <p className="mt-5 border-l-2 accent-border bg-ink-800 px-4 py-3 text-[12.5px] leading-relaxed text-chalk-dim">
                  Las alertas internas llegan a la dirección definida en la variable{' '}
                  <code className="font-mono">ADMIN_ALERT_EMAIL</code>. Si no hay servidor SMTP
                  configurado, los correos se registran en el log del servidor y la tienda sigue
                  funcionando normalmente.
                </p>
              </Card>
            ),
          },
        ]}
      />

      <div className="sticky bottom-4 mt-5 flex items-center gap-4 border border-line bg-ink-900 p-4">
        <Submit />
        <p className="text-[12.5px] text-chalk-faint">
          Los cambios se aplican de inmediato en toda la tienda.
        </p>
      </div>
    </form>
  );
}
