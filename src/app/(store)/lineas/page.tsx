import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLineComparison } from '@/lib/catalog';
import { buildMetadata } from '@/lib/seo';
import { LineCompare } from '@/components/store/LineCompare';
import { ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'R-SKIN o VEL-SKIN — en qué se diferencian',
  description:
    'R-SKIN y VEL-SKIN comparadas dato a dato: peso, compresión, absorción de agua y vida útil. ' +
    'Cuál conviene según cómo compites.',
  path: '/lineas',
});

/**
 * La página que resuelve la pregunta que traía a la gente al WhatsApp: los dos
 * trajes se ven casi iguales en la foto y uno cuesta $40.000 más. Acá están
 * enfrentados dato a dato, sin ningún producto seleccionado.
 */
export default async function LinesPage() {
  const columns = await getLineComparison();
  // Con una línea apagada no queda nada que comparar.
  if (columns.length < 2) redirect('/catalogo');

  return (
    <>
      <nav aria-label="Ruta de navegación" className="border-b border-line-soft">
        <ol className="container flex items-center gap-2 py-3.5 text-[12px] text-chalk-faint">
          <li><Link href="/" className="hover:text-chalk">Inicio</Link></li>
          <li aria-hidden>/</li>
          <li className="text-chalk-dim">Las líneas</li>
        </ol>
      </nav>

      <section className="bg-ink-900">
        <div className="container pb-2 pt-12 lg:pt-16">
          <p className="eyebrow-accent mb-3">Las líneas</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[48px]">
            {columns.map((c) => c.name).join(' o ')}: qué traje de competencia elegir
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-chalk-dim">
            Las dos líneas están homologadas por World Aquatics y en la foto se ven casi iguales. Abajo
            están enfrentadas fila por fila, con el dato de cada una, para que sepas qué pagas de más.
          </p>
        </div>
      </section>

      <LineCompare columns={columns} activeSlug={null} />

      <section className="border-t border-line bg-ink-900">
        <div className="container flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-14">
          <div>
            <h2 className="font-display text-[22px] leading-none tracking-tight text-chalk">
              ¿Sigues con la duda?
            </h2>
            <p className="mt-2.5 max-w-xl text-[14.5px] leading-relaxed text-chalk-dim">
              Cuéntanos en qué pruebas compites y cuántas fechas tienes en la temporada, y te decimos
              cuál de las dos líneas te conviene.
            </p>
          </div>
          <ButtonLink href="/contacto" size="lg" className="shrink-0">
            Escríbenos
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
