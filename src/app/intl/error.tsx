'use client';

import { useEffect } from 'react';

export default function IntlError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[intl:error]', error);
  }, [error]);

  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 sm:pt-28">
      <h1 className="max-w-[16ch] text-[clamp(40px,6vw,88px)] leading-[0.95]">No pudimos cargar esta página.</h1>
      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-graphite-soft">
        Fue un problema de nuestro lado. Inténtalo de nuevo en un momento.
      </p>
      {error.digest ? <p className="mt-3 text-[12px] text-graphite-faint">Ref: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-10 bg-cobalt px-7 py-4 text-[15px] font-medium text-white transition-colors hover:bg-cobalt-hover"
      >
        Reintentar
      </button>
    </section>
  );
}
