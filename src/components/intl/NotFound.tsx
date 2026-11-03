import Link from 'next/link';

/** El 404 de taupoc.lat, tanto dentro de sus páginas como para rutas que no existen. */
export function IntlNotFoundContent() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 sm:pt-28">
      <p className="text-[13px] text-graphite-soft">Error 404</p>
      <h1 className="mt-4 max-w-[16ch] text-[clamp(40px,6vw,88px)] leading-[0.95]">Esta página no existe.</h1>
      <Link
        href="/"
        className="mt-10 inline-block bg-cobalt px-7 py-4 text-[15px] font-medium text-white transition-colors hover:bg-cobalt-hover"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
