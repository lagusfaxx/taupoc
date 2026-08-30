import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PasswordForm, ProfileForm } from '@/components/store/ProfileForms';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Mis datos', path: '/cuenta/datos', noIndex: true });

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return null;

  return (
    <div className="space-y-8">
      <section className="surface p-6">
        <h2 className="font-display text-[13px] uppercase tracking-widest text-chalk">Datos personales</h2>
        <p className="mt-1.5 text-[13px] text-chalk-faint">
          Usamos estos datos para prellenar tu próximo checkout.
        </p>
        <div className="mt-6">
          <ProfileForm
            defaults={{
              name: user.name,
              lastName: user.lastName ?? '',
              phone: user.phone ?? '',
              clubName: user.clubName ?? '',
              acceptsMarketing: user.acceptsMarketing,
            }}
          />
        </div>
      </section>

      <section className="surface p-6">
        <h2 className="font-display text-[13px] uppercase tracking-widest text-chalk">Contraseña</h2>
        <div className="mt-6">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
