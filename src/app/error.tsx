'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app:error]', error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] items-center py-20">
      <div className="mx-auto max-w-lg text-center">
        <p className="eyebrow-accent mb-4">Algo salió mal</p>
        <h1 className="text-balance font-display text-[34px] leading-none tracking-tightest text-chalk sm:text-[44px]">
          No pudimos cargar esta página
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-chalk-dim">
          Fue un problema de nuestro lado. Puedes reintentar o volver al catálogo.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[12px] text-chalk-faint">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} size="lg">Reintentar</Button>
          <ButtonLink href="/catalogo" variant="outline" size="lg">Ver catálogo</ButtonLink>
        </div>
      </div>
    </div>
  );
}
