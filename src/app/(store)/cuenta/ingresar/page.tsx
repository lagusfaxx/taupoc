import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { LoginForm } from '@/components/store/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Ingresar', path: '/cuenta/ingresar', noIndex: true });

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSession()) redirect('/cuenta');
  const params = await searchParams;
  const redirectTo = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <div className="container py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow-accent mb-3">TAUPOC Chile</p>
        <h1 className="font-display text-[30px] leading-none tracking-tightest text-chalk">Ingresar</h1>
        <p className="mt-3 text-[14px] text-chalk-faint">
          Accede a tu historial de pedidos, seguimiento de envío y direcciones guardadas.
        </p>
        <div className="mt-8 surface p-6 sm:p-8">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
