import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { AccountNav } from '@/components/store/AccountNav';

/** Las páginas públicas de autenticación no llevan el marco de la cuenta. */
const PUBLIC_PATHS = ['/cuenta/ingresar', '/cuenta/registro', '/cuenta/recuperar', '/cuenta/restablecer'];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>;

  const user = await getCurrentUser();
  if (!user) return <>{children}</>;

  return (
    <div className="container py-10 lg:py-16">
      <p className="eyebrow-accent mb-3">Mi cuenta</p>
      <h1 className="font-display text-[30px] leading-none tracking-tightest text-chalk sm:text-[38px]">
        Hola, {user.name}
      </h1>
      <p className="mt-2.5 text-[14px] text-chalk-faint">{user.email}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <AccountNav />
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
