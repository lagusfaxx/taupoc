import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { ContactForm } from '@/components/store/ContactForm';
import { IconInstagram, IconWhatsapp } from '@/components/ui/Icons';

// El encabezado lee el cookie del carrito, así que esta página se renderiza
// en cada solicitud de todos modos. Declararlo explícitamente hace que la
// compilación de la imagen Docker no necesite una base de datos, y garantiza
// que el stock mostrado sea siempre el real.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Contacto',
  description:
    'Consultas de talla, estado de pedidos, cambios y cotizaciones para clubes. Te respondemos dentro ' +
    'de 24 horas hábiles.',
  path: '/contacto',
});

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <section className="border-b border-line bg-ink-900">
        <div className="container py-12 lg:py-16">
          <p className="eyebrow-accent mb-3">Hablemos</p>
          <h1 className="max-w-2xl text-balance font-display text-[32px] leading-[1.02] tracking-tightest text-chalk sm:text-[42px]">
            ¿Dudas de talla? Pregunta antes de comprar.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15.5px] leading-relaxed text-chalk-dim">
            Es la consulta más frecuente que recibimos y la que más devoluciones evita. Escríbenos con las
            medidas del nadador y te decimos exactamente qué pedir.
          </p>
        </div>
      </section>

      <div className="container py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <h2 className="font-display text-[15px] uppercase tracking-widest text-chalk">
              Canales directos
            </h2>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              <div className="py-4">
                <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Correo</dt>
                <dd className="mt-1.5">
                  <a href={`mailto:${settings.contactEmail}`} className="text-[15px] text-chalk hover:accent-text">
                    {settings.contactEmail}
                  </a>
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Teléfono</dt>
                <dd className="mt-1.5 text-[15px] text-chalk">{settings.contactPhone}</dd>
              </div>
              <div className="py-4">
                <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Dirección</dt>
                <dd className="mt-1.5 text-[15px] text-chalk">{settings.addressLine}</dd>
              </div>
              <div className="py-4">
                <dt className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">Horario</dt>
                <dd className="mt-1.5 text-[15px] text-chalk">Lunes a viernes, 10:00 a 19:00</dd>
              </div>
            </dl>

            <div className="mt-6 flex gap-2">
              {settings.whatsapp ? (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-line px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-border hover:accent-text"
                >
                  <IconWhatsapp className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
              {settings.instagram ? (
                <a
                  href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-line px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-border hover:accent-text"
                >
                  <IconInstagram className="h-4 w-4" />
                  Instagram
                </a>
              ) : null}
            </div>

            <p className="mt-8 border-l-2 accent-border bg-ink-900 px-4 py-3.5 text-[13.5px] leading-relaxed text-chalk-dim">
              También estamos con stand en los torneos del calendario nacional, con el muestrario completo
              de tallas para que te pruebes antes de comprar.
            </p>
          </div>

          <ContactForm />
        </div>
      </div>
    </>
  );
}
