import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { RegisterForm } from '@/components/store/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Crear cuenta', path: '/cuenta/registro', noIndex: true });

export default async function RegisterPage() {
  if (await getSession()) redirect('/cuenta');
  return (
    <div className="container py-16 lg:py-24">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow-accent mb-3">TAUPOC Chile</p>
        <h1 className="font-display text-[30px] leading-none tracking-tightest text-chalk">Crear cuenta</h1>
        <p className="mt-3 text-[14px] text-chalk-faint">
          Compra más rápido, sigue tus envíos y guarda tus tallas para el próximo torneo.
        </p>
        <div className="mt-8 surface p-6 sm:p-8">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
