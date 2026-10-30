import Link from 'next/link';

/*
 * Marco de taupoc.lat: la marca a la izquierda y nada más que lo necesario.
 * La interfaz se aparta para que mande la fotografía. Los enlaces de
 * navegación entran a medida que existan sus páginas.
 */

export function IntlHeader() {
  return (
    <header className="bg-paper">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center px-4 sm:h-20 sm:px-8">
        <Link href="/" className="font-editorial text-[19px] font-semibold tracking-[0.18em] text-graphite">
          TAUPOC
        </Link>
      </div>
    </header>
  );
}

export function IntlFooter() {
  return (
    <footer className="mt-32 bg-paper">
      <div className="mx-auto max-w-[1600px] px-4 py-12 text-[13px] text-graphite-soft sm:px-8">
        <p>TAUPOC · Trajes de competencia homologados World Aquatics · Envíos a toda Latinoamérica</p>
      </div>
    </footer>
  );
}
