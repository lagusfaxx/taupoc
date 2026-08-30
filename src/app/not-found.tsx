import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-line">
        <div className="container flex h-16 items-center">
          <Link href="/" aria-label="TAUPOC Chile — inicio">
            <Logo />
          </Link>
        </div>
      </div>

      <main className="container flex flex-1 items-center py-20">
        <div className="mx-auto max-w-lg text-center">
          <p className="eyebrow-accent mb-4">Error 404</p>
          <h1 className="text-balance font-display text-[40px] leading-none tracking-tightest text-chalk sm:text-[56px]">
            Esta página no existe
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-chalk-dim">
            El enlace puede estar roto o el producto ya no está en catálogo. Prueba desde el catálogo
            completo.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/catalogo" size="lg">Ver catálogo</ButtonLink>
            <ButtonLink href="/" variant="outline" size="lg">Ir al inicio</ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
