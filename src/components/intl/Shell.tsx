import Link from 'next/link';

/*
 * Marco de taupoc.lat: la marca a la izquierda, tres palabras de navegación
 * y nada más. La interfaz se aparta para que mande la fotografía.
 */

const NAV = [
  { href: '/catalogo?genero=hombre', label: 'Hombre', className: '' },
  { href: '/catalogo?genero=mujer', label: 'Mujer', className: '' },
  // En teléfono no cabe: Hombre y Mujer ya llevan al catálogo.
  { href: '/catalogo', label: 'Catálogo', className: 'hidden sm:list-item' },
];

export function IntlHeader({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <header className="bg-paper">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-6 px-4 sm:h-20 sm:px-8">
        <Link href="/" className="font-editorial text-[19px] font-semibold tracking-[0.18em] text-graphite">
          TAUPOC
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-5 text-[15px] text-graphite sm:gap-8">
            {NAV.map((item) => (
              <li key={item.href} className={item.className}>
                <Link href={item.href} className="underline-offset-[6px] hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="/carrito" className="underline-offset-[6px] hover:underline">
                Carrito{cartCount > 0 ? ` (${cartCount})` : ''}
              </a>
            </li>
          </ul>
        </nav>
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
