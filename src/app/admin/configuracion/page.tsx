import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { mpConfigured, mpMode } from '@/lib/mercadopago';
import { mailTransport } from '@/lib/mail';
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { MailTester } from '@/components/admin/MailTester';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Ajustes', noIndex: true });

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const settings = await getSettings();

  const transport = mailTransport();
  const mpReady = mpConfigured();

  return (
    <>
      <PageHeader
        title="Ajustes de la tienda"
        description="Todo lo que se puede cambiar sin tocar código ni volver a desplegar."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="border border-line bg-ink-900 p-4">
          <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Mercado Pago</p>
          <div className="mt-2">
            {mpReady ? (
              <Badge tone={mpMode() === 'live' ? 'ok' : 'info'}>
                {mpMode() === 'live' ? 'Producción' : 'Ambiente de pruebas'}
              </Badge>
            ) : (
              <Badge tone="bad">Sin configurar</Badge>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-chalk-faint">
            Se configura con las variables MP_ACCESS_TOKEN y MP_MODE.
          </p>
        </div>

        <div className="border border-line bg-ink-900 p-4">
          <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Correo saliente</p>
          <div className="mt-2">
            <Badge tone={transport === 'none' ? 'warn' : 'ok'}>
              {transport === 'resend' ? 'Resend' : transport === 'smtp' ? 'SMTP' : 'Sin configurar'}
            </Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-chalk-faint">
            {transport === 'none'
              ? 'Los correos se registran en el log, sin interrumpir las compras.'
              : 'El remitente debe usar un dominio verificado en el proveedor.'}
          </p>
        </div>

        <div className="border border-line bg-ink-900 p-4">
          <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Analítica</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={settings.gaMeasurementId ? 'ok' : 'muted'}>GA4</Badge>
            <Badge tone={settings.gtmId ? 'ok' : 'muted'}>GTM</Badge>
            <Badge tone={settings.metaPixelId ? 'ok' : 'muted'}>Meta Pixel</Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-chalk-faint">
            Se activan pegando el ID en la pestaña Analítica.
          </p>
        </div>
      </div>

      <SettingsForm settings={settings} />

      <MailTester
        defaultEmail={process.env.ADMIN_ALERT_EMAIL || admin.email || settings.contactEmail}
      />
    </>
  );
}
