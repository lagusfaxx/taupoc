import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { LoginForm } from '@/components/store/AuthForms';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Ingresar', noIndex: true });

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user && isStaff(user.role)) redirect('/admin');

  const params = await searchParams;
  const permissionError = params.error === 'permisos';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
          <p className="mt-4 font-display text-[10px] uppercase tracking-mega text-chalk-faint">
            Panel de administración
          </p>
        </div>

        {permissionError ? (
          <p
            role="alert"
            className="mb-5 border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad"
          >
            Tu cuenta no tiene permisos para acceder al panel.
          </p>
        ) : null}

        <div className="surface p-7">
          <LoginForm redirectTo="/admin" />
        </div>

        <p className="mt-6 text-center text-[12.5px] text-chalk-faint">
          Acceso restringido al equipo de TAUPOC Chile.
        </p>
      </div>
    </div>
  );
}
