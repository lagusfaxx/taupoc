import type { Metadata } from 'next';
import Link from 'next/link';
import { getIntlCards } from '@/lib/intl-catalog';
import { intlMetadata } from '@/lib/intl-seo';
import { ProductGrid } from '@/components/intl/ProductGrid';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = intlMetadata({
  title: 'TAUPOC — Trajes de competencia homologados World Aquatics',
  absoluteTitle: true,
  description:
    'Jammers y knee suits TAUPOC homologados por World Aquatics, con envío a toda Latinoamérica y pago en dólares.',
  path: '/',
  clPath: '/',
});

export default async function IntlHome() {
  const [men, women] = await Promise.all([getIntlCards({ gender: 'MALE' }), getIntlCards({ gender: 'FEMALE' })]);

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-4 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-24">
        <h1 className="max-w-[13ch] text-[clamp(44px,8vw,128px)] leading-[0.95]">
          Trajes de competencia para nadar más rápido.
        </h1>
        <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-graphite-soft">
          Jammers y knee suits homologados por World Aquatics, con envío a toda Latinoamérica y pago en dólares.
        </p>
      </section>

      <Collection id="hombre" title="Hombre" subtitle="Jammer" href="/catalogo?genero=hombre" cards={men} priority={2} />
      <Collection id="mujer" title="Mujer" subtitle="Knee suit" href="/catalogo?genero=mujer" cards={women} />
    </>
  );
}

function Collection({
  id,
  title,
  subtitle,
  href,
  cards,
  priority = 0,
}: {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  cards: Awaited<ReturnType<typeof getIntlCards>>;
  priority?: number;
}) {
  if (cards.length === 0) return null;
  return (
    <section id={id} className="mx-auto max-w-[1600px] px-4 pb-28 sm:px-8">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[clamp(32px,4.5vw,64px)] leading-none">{title}</h2>
          <p className="mt-3 text-[15px] text-graphite-soft">{subtitle}</p>
        </div>
        <Link href={href} className="shrink-0 text-[15px] text-cobalt underline-offset-[6px] hover:underline">
          Ver todo
        </Link>
      </div>
      <ProductGrid cards={cards.slice(0, 6)} priority={priority} />
    </section>
  );
}
