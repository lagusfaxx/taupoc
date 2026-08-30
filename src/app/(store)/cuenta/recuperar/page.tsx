import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { ForgotForm } from '@/components/store/AuthForms';

export const metadata: Metadata = buildMetadata({ title: 'Recuperar contraseña', path: '/cuenta/recuperar', noIndex: true });

export default function ForgotPage() {
  return (
    <div className="container py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-[28px] leading-none tracking-tightest text-chalk">
          Recuperar contraseña
        </h1>
        <p className="mt-3 text-[14px] text-chalk-faint">
          Te enviamos un enlace para crear una nueva. El enlace vence en una hora.
        </p>
        <div className="mt-8 surface p-6 sm:p-8">
          <ForgotForm />
        </div>
      </div>
    </div>
  );
}
