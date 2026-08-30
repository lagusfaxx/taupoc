import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getFeatured } from '@/lib/catalog';
import { formatCLP } from '@/lib/money';
import { buildMetadata, jsonLd, absoluteUrl, SITE_NAME } from '@/lib/seo';
import { formatDate } from '@/lib/utils';
import { ProductCard } from '@/components/store/ProductCard';
import { SectionHeading } from '@/components/store/SectionHeading';
import { ButtonLink } from '@/components/ui/Button';
import {
  IconArrow, IconBox, IconRuler, IconShield, IconTruck, IconUsers,
} from '@/components/ui/Icons';

export const metadata: Metadata = buildMetadata({
  title: 'Trajes de competición homologados World Aquatics',
  description:
    'Distribuidor oficial TAUPOC en Chile. Jammers y knee suits de competición homologados por World Aquatics, ' +
    'con despacho a todo el país y retiro sin costo en Santiago.',
  path: '/',
});

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

const PILLARS = [
  {
    icon: IconShield,
    title: 'Homologación verificable',
    body: 'Cada modelo lleva su código World Aquatics publicado en la ficha. Tu entrenador puede comprobarlo en la base oficial antes de comprar.',
  },
  {
    icon: IconBox,
    title: 'Disponibilidad inmediata',
    body: 'Lo que aparece disponible está en bodega en Santiago y sale despachado el mismo día hábil. Sin "consultar disponibilidad".',
  },
  {
    icon: IconTruck,
    title: 'Despacho a todo Chile',
    body: 'Chilexpress, Starken y Correos de Chile. Retiro sin costo en Santiago o entrega en nuestro stand de torneo.',
  },
  {
    icon: IconUsers,
    title: 'Condiciones para clubes',
    body: 'Precio por volumen desde 10 unidades, con asesoría de tallas para todo el equipo y entrega coordinada.',
  },
];

export default async function HomePage() {
  const [settings, featured, posts, lines, skuCount] = await Promise.all([
    getSettings(),
    getFeatured(4),
    prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: { slug: true, title: true, excerpt: true, coverUrl: true, publishedAt: true, tags: true },
    }),
    prisma.productLine.findMany({
      where: { active: true, slug: { not: 'accesorios' } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.variant.count({ where: { active: true } }),
  ]);

  const approvals = await prisma.product.findMany({
    where: { approvalCode: { not: null }, status: { in: ['ACTIVE', 'COMING_SOON'] } },
    select: { name: true, modelCode: true, approvalCode: true, slug: true, status: true },
    orderBy: { sortOrder: 'asc' },
  });

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: SITE_NAME,
    description:
      'Distribuidor oficial de TAUPOC Swimwear en Chile. Trajes de competición homologados por World Aquatics.',
    url: absoluteUrl('/'),
    email: settings.contactEmail,
    telephone: settings.contactPhone,
    address: { '@type': 'PostalAddress', addressLocality: 'Santiago', addressCountry: 'CL' },
    currenciesAccepted: 'CLP',
    paymentAccepted: 'Tarjeta de crédito, tarjeta de débito, Mercado Pago',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organization)} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10">
          {settings.heroImageUrl ? (
            <Image
              src={settings.heroImageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[70%_center]"
            />
          ) : (
            <div className="h-full w-full bg-ink-800" />
          )}
          <div className="absolute inset-0 bg-fade-r" />
          <div className="absolute inset-0 bg-fade-b" />
          <div className="absolute inset-0 bg-grid-tech bg-grid-tech opacity-60" />
        </div>

        <div className="container flex min-h-[560px] flex-col justify-center py-20 sm:min-h-[640px] lg:min-h-[76vh] lg:py-28">
          <div className="max-w-2xl animate-rise-in">
            <p className="eyebrow-accent mb-5 flex items-center gap-2.5">
              <span className="inline-block h-[1px] w-8 bg-[var(--accent)]" aria-hidden />
              {settings.tagline}
            </p>

            <h1 className="text-balance font-display text-[42px] font-extrabold leading-[0.94] tracking-tightest text-chalk sm:text-[64px] lg:text-[86px]">
              {settings.heroTitle}
            </h1>

            <p className="mt-6 max-w-lg text-pretty text-[15px] leading-relaxed text-chalk-dim sm:text-[17px]">
              {settings.heroSubtitle}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href={settings.heroCtaHref || '/catalogo'} size="lg">
                {settings.heroCtaLabel || 'Ver catálogo'}
                <IconArrow className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/guia-de-tallas" variant="outline" size="lg">
                <IconRuler className="h-4 w-4" />
                Guía de tallas
              </ButtonLink>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-line-soft pt-7">
              {[
                { k: `${skuCount}`, v: 'SKU en catálogo' },
                { k: '20 – 36', v: 'Tallas de competición' },
                { k: 'World Aquatics', v: 'Homologación oficial' },
              ].map((stat) => (
                <div key={stat.v}>
                  <dt className="font-display text-[22px] font-bold tracking-tight text-chalk">{stat.k}</dt>
                  <dd className="mt-0.5 font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                    {stat.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Homologación: el argumento central ───────────────── */}
      <section id="homologacion" className="border-b border-line bg-ink-900">
        <div className="container py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="eyebrow-accent mb-3">Lo que nos legitima</p>
              <h2 className="text-balance font-display text-[30px] leading-[1.04] tracking-tightest text-chalk sm:text-[40px]">
                Un código que el juez puede verificar en la piscina.
              </h2>
              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-chalk-dim">
                En un campeonato oficial, el juez árbitro puede pedir revisar el traje antes de la salida.
                Si el modelo no aparece en la lista de trajes aprobados por World Aquatics, el nadador
                no larga. Sin apelación.
              </p>
              <p className="mt-4 text-pretty text-[15px] leading-relaxed text-chalk-dim">
                Por eso publicamos el código de homologación completo de cada modelo, junto al enlace
                directo a la base oficial. No pedimos que nos creas: te damos con qué comprobarlo.
              </p>
              <Link
                href="/marca#homologacion"
                className="group mt-7 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest accent-text"
              >
                Cómo funciona la homologación
                <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="surface divide-y divide-line">
              <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
                <IconShield className="h-5 w-5 accent-text" />
                <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-chalk">
                  Registro World Aquatics · Modelos TAUPOC
                </p>
              </div>
              {approvals.map((p) => (
                <Link
                  key={p.slug}
                  href={`/producto/${p.slug}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-ink-800 sm:px-6"
                >
                  <div>
                    <p className="font-display text-[14px] font-semibold tracking-tight text-chalk">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-chalk-faint">
                      Modelo {p.modelCode}
                      {p.status === 'COMING_SOON' ? ' · Próximamente' : ''}
                    </p>
                  </div>
                  <span className="border accent-border bg-ink-800 px-2.5 py-1.5 font-mono text-[13px] tracking-wider accent-text">
                    {p.approvalCode}
                  </span>
                </Link>
              ))}
              <div className="px-5 py-4 sm:px-6">
                <a
                  href="https://www.worldaquatics.com/swimming/approved-swimwear"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-chalk-faint underline underline-offset-4 hover:text-chalk"
                >
                  Verificar en la lista oficial de World Aquatics ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Productos destacados ─────────────────────────────── */}
      <section className="border-b border-line">
        <div className="container py-16 lg:py-24">
          <SectionHeading
            eyebrow="Catálogo"
            title="Equipamiento de carrera"
            description="Cada talla y color es un SKU con stock propio. Lo que ves disponible, está disponible hoy."
            link={{ href: '/catalogo', label: 'Ver todo' }}
          />

          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {featured.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 2} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Líneas técnicas ──────────────────────────────────── */}
      <section className="border-b border-line bg-ink-900">
        <div className="container py-16 lg:py-24">
          <SectionHeading eyebrow="Líneas" title="Dos generaciones, un mismo ADN" />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={`/catalogo?linea=${line.slug}`}
                className="group relative overflow-hidden border border-line bg-ink-800 p-8 transition-colors hover:border-line-bright lg:p-10"
                style={{ ['--accent' as string]: line.accentHex }}
              >
                <span
                  className="absolute left-0 top-0 h-full w-[3px] transition-all duration-500 group-hover:w-[6px]"
                  style={{ background: line.accentHex }}
                  aria-hidden
                />
                <p className="eyebrow-accent mb-3">{line.tagline}</p>
                <h3 className="font-display text-[32px] leading-none tracking-tightest text-chalk lg:text-[40px]">
                  {line.name}
                </h3>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-chalk-dim">
                  {line.description}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest accent-text">
                  Ver la línea
                  <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pilares ──────────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="container py-16 lg:py-24">
          <SectionHeading
            eyebrow="Por qué comprar acá"
            title="Lo que arena y Speedo no te dan en Chile"
            description="No competimos por marca. Competimos por disponibilidad real, precio y trazabilidad de la homologación."
          />
          <div className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="bg-ink p-7 lg:p-8">
                <pillar.icon className="h-6 w-6 accent-text" />
                <h3 className="mt-5 font-display text-[15px] tracking-tight text-chalk">{pillar.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-faint">{pillar.body}</p>
              </div>
            ))}
          </div>

          {settings.freeShippingOver ? (
            <p className="mt-6 text-center text-[13px] text-chalk-faint">
              Despacho sin costo en compras sobre{' '}
              <strong className="accent-text">{formatCLP(settings.freeShippingOver)}</strong>.
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Clubes ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line bg-ink-900">
        <div className="absolute inset-0 bg-grid-tech bg-grid-tech opacity-70" aria-hidden />
        <div className="container relative py-16 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="eyebrow-accent mb-3">Clubes y equipos</p>
              <h2 className="text-balance font-display text-[30px] leading-[1.04] tracking-tightest text-chalk sm:text-[40px]">
                Vestir a todo el equipo no debería costar una temporada de cuotas.
              </h2>
              <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-chalk-dim">
                Trabajamos con clubes federados en todo Chile: precio por volumen desde 10 unidades,
                asesoría de tallas para el plantel completo y entrega coordinada en la sede o en el torneo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/clubes" size="lg">Pedir cotización</ButtonLink>
                <ButtonLink href="/contacto" variant="outline" size="lg">Hablar con nosotros</ButtonLink>
              </div>
            </div>

            <ul className="surface divide-y divide-line">
              {[
                ['Desde 10 unidades', 'Descuento por volumen escalonado'],
                ['Asesoría de tallas', 'Medición del plantel con nuestra tabla técnica'],
                ['Entrega coordinada', 'En la sede del club o en el stand del torneo'],
                ['Facturación', 'Documento tributario a nombre del club'],
              ].map(([title, body]) => (
                <li key={title} className="px-6 py-5">
                  <p className="font-display text-[13px] font-semibold uppercase tracking-wide text-chalk">
                    {title}
                  </p>
                  <p className="mt-1 text-[13px] text-chalk-faint">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Blog ─────────────────────────────────────────────── */}
      {posts.length > 0 ? (
        <section>
          <div className="container py-16 lg:py-24">
            <SectionHeading
              eyebrow="Contenido técnico"
              title="Guías, normativa y resultados"
              link={{ href: '/blog', label: 'Todas las notas' }}
            />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {posts.map((post) => (
                <article key={post.slug} className="group">
                  <Link href={`/blog/${post.slug}`} className="block overflow-hidden border border-line bg-ink-800">
                    <div className="relative aspect-[16/9]">
                      {post.coverUrl ? (
                        <Image
                          src={post.coverUrl}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 90vw, 30vw"
                          className="object-cover transition-transform duration-700 ease-tech group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                  </Link>
                  <div className="pt-5">
                    <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                      {post.tags[0] ?? 'Nota'} · {formatDate(post.publishedAt)}
                    </p>
                    <h3 className="mt-2.5 font-display text-[17px] leading-tight tracking-tight text-chalk">
                      <Link href={`/blog/${post.slug}`} className="hover:accent-text">
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-chalk-faint">
                      {post.excerpt}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
