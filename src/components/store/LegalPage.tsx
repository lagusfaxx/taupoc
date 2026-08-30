import type { ReactNode } from 'react';

/** Marco compartido por las páginas de contenido legal y de ayuda. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
  updatedAt,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  updatedAt?: string;
}) {
  return (
    <>
      <section className="border-b border-line bg-ink-900">
        <div className="container py-12 lg:py-16">
          <p className="eyebrow-accent mb-3">{eyebrow}</p>
          <h1 className="max-w-3xl text-balance font-display text-[32px] leading-[1.02] tracking-tightest text-chalk sm:text-[42px]">
            {title}
          </h1>
          {intro ? (
            <p className="mt-5 max-w-2xl text-pretty text-[15.5px] leading-relaxed text-chalk-dim">{intro}</p>
          ) : null}
        </div>
      </section>

      <div className="container py-12 lg:py-16">
        <div className="prose-taupoc max-w-2xl">{children}</div>
        {updatedAt ? (
          <p className="mt-12 max-w-2xl border-t border-line pt-5 text-[12.5px] text-chalk-faint">
            Última actualización: {updatedAt}
          </p>
        ) : null}
      </div>
    </>
  );
}
