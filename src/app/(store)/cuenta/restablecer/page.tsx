import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { ResetForm } from '@/components/store/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Nueva contraseña', path: '/cuenta/restablecer', noIndex: true });

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  return (
    <div className="container py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-[28px] leading-none tracking-tightest text-chalk">
          Nueva contraseña
        </h1>
        {token ? (
          <div className="mt-8 surface p-6 sm:p-8">
            <ResetForm token={token} />
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-chalk-faint">
            El enlace no es válido.{' '}
            <Link href="/cuenta/recuperar" className="accent-text hover:underline">
              Solicita uno nuevo
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
