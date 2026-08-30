import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { Logo } from '@/components/ui/Logo';
import { IconInstagram, IconWhatsapp } from '@/components/ui/Icons';
import { NewsletterForm } from './NewsletterForm';

const COLUMNS = [
  {
    title: 'Competición',
    links: [
      { label: 'Jammers hombre', href: '/catalogo?genero=MALE' },
      { label: 'Knee suits mujer', href: '/catalogo?genero=FEMALE' },
      { label: 'Línea R-SKIN', href: '/catalogo?linea=r-skin' },
      { label: 'Línea VEL-SKIN', href: '/catalogo?linea=vel-skin' },
      { label: 'Ver todo', href: '/catalogo' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Guía de tallas', href: '/guia-de-tallas' },
      { label: 'Envíos y plazos', href: '/envios' },
      { label: 'Cambios y devoluciones', href: '/devoluciones' },
      { label: 'Cuidado del traje', href: '/blog/como-elegir-la-talla-de-tu-traje-de-competicion' },
      { label: 'Contacto', href: '/contacto' },
    ],
  },
  {
    title: 'TAUPOC Chile',
    links: [
      { label: 'La marca', href: '/marca' },
      { label: 'Homologación World Aquatics', href: '/marca#homologacion' },
      { label: 'Clubes y equipos', href: '/clubes' },
      { label: 'Blog', href: '/blog' },
      { label: 'Términos y condiciones', href: '/terminos' },
    ],
  },
];

export async function Footer() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-ink-900">
      <div className="container py-14 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-10">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-chalk-faint">
              Distribuidor oficial de TAUPOC Swimwear en Chile. Trajes de competición homologados por
              World Aquatics, con stock real de tallas y despacho a todo el país.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {settings.whatsapp ? (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="flex h-10 w-10 items-center justify-center border border-line text-chalk-dim transition-colors hover:accent-border hover:accent-text"
                >
                  <IconWhatsapp className="h-[18px] w-[18px]" />
                </a>
              ) : null}
              {settings.instagram ? (
                <a
                  href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-10 w-10 items-center justify-center border border-line text-chalk-dim transition-colors hover:accent-border hover:accent-text"
                >
                  <IconInstagram className="h-[18px] w-[18px]" />
                </a>
              ) : null}
            </div>

            <dl className="mt-7 space-y-1.5 text-[13px] text-chalk-faint">
              <div className="flex gap-2">
                <dt className="sr-only">Correo</dt>
                <dd>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-chalk">
                    {settings.contactEmail}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Teléfono</dt>
                <dd>{settings.contactPhone}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Dirección</dt>
                <dd>{settings.addressLine}</dd>
              </div>
            </dl>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="eyebrow mb-4">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-[14px] text-chalk-dim transition-colors hover:text-chalk">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 border-t border-line pt-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-lg tracking-tight text-chalk">
                Resultados, stock y torneos
              </h2>
              <p className="mt-2 max-w-md text-[14px] text-chalk-faint">
                Avisos de reposición de tallas, fechas de stand en torneos y contenido técnico.
                Sin spam.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="border-t border-line-soft">
        <div className="container flex flex-col gap-3 py-6 text-[12px] text-chalk-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {settings.storeName}. Todos los derechos reservados.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-display text-[10px] uppercase tracking-widest">
              Pagos procesados por Mercado Pago
            </span>
            <Link href="/terminos" className="hover:text-chalk">Términos</Link>
            <Link href="/privacidad" className="hover:text-chalk">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
