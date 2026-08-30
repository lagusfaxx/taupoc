import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCart } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { CheckoutForm } from '@/components/store/CheckoutForm';
import { mpConfigured, mpMode } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Finalizar compra',
  path: '/checkout',
  noIndex: true,
});

export default async function CheckoutPage() {
  const [cart, user, settings] = await Promise.all([getCart(), getCurrentUser(), getSettings()]);

  if (cart.lines.length === 0) redirect('/carrito');

  const address = user
    ? await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })
    : null;

  return (
    <div className="container py-10 lg:py-16">
      <h1 className="font-display text-[30px] leading-none tracking-tightest text-chalk sm:text-[40px]">
        Finalizar compra
      </h1>
      <p className="mt-2.5 text-[14px] text-chalk-faint">
        Pago procesado por Mercado Pago · Crédito, débito y cuotas
      </p>

      {!mpConfigured() ? (
        <p className="mt-6 border border-signal-warn/40 bg-signal-warn/10 px-4 py-3 text-[13.5px] text-signal-warn">
          La pasarela de pago aún no está configurada. Puedes dejar tu pedido registrado y te
          contactamos para coordinar el pago.
        </p>
      ) : mpMode() === 'test' ? (
        <p className="mt-6 border border-signal-info/40 bg-signal-info/10 px-4 py-3 text-[13.5px] text-signal-info">
          Ambiente de pruebas de Mercado Pago activo. No se realizarán cobros reales.
        </p>
      ) : null}

      <div className="mt-10">
        <CheckoutForm
          cart={cart}
          installmentsMax={settings.installmentsMax}
          defaults={{
            email: user?.email ?? '',
            firstName: user?.name ?? address?.firstName ?? '',
            lastName: user?.lastName ?? address?.lastName ?? '',
            phone: user?.phone ?? address?.phone ?? '',
            rut: user?.rut ?? '',
            region: address?.region ?? '',
            commune: address?.commune ?? '',
            street: address?.street ?? '',
            streetNumber: address?.number ?? '',
            addressExtra: address?.extra ?? '',
          }}
        />
      </div>
    </div>
  );
}
