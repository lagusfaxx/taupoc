import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';
import { readingMinutes } from '@/lib/markdown';
import { Empty } from '@/components/ui/Empty';
import { IconDoc } from '@/components/ui/Icons';

// El encabezado lee el cookie del carrito, así que esta página se renderiza
// en cada solicitud de todos modos. Declararlo explícitamente hace que la
// compilación de la imagen Docker no necesite una base de datos, y garantiza
// que el stock mostrado sea siempre el real.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Blog — guías técnicas, normativa y resultados',
  description:
    'Guías de talla, normativa de World Aquatics, cuidado del traje y resultados de nuestros atletas. ' +
    'Contenido para nadadores de competencia, entrenadores y apoderados.',
  path: '/blog',
});

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
  });

  const [featured, ...rest] = posts;

  return (
    <>
      <section className="border-b border-line bg-ink-900">
        <div className="container py-14 lg:py-20">
          <p className="eyebrow-accent mb-3">Contenido técnico</p>
          <h1 className="max-w-2xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[46px]">
            Guías, normativa y resultados
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-chalk-dim">
            Lo que necesitas saber antes de comprar un traje de carrera, y lo que pasa con nuestros
            nadadores en el agua.
          </p>
        </div>
      </section>

      <div className="container py-12 lg:py-16">
        {posts.length === 0 ? (
          <Empty
            icon={<IconDoc className="h-9 w-9" />}
            title="Todavía no publicamos notas"
            description="Estamos preparando las primeras guías. Vuelve pronto."
          />
        ) : (
          <>
            {featured ? (
              <article className="group mb-14 grid gap-8 border-b border-line pb-14 lg:grid-cols-2 lg:gap-12">
                <Link href={`/blog/${featured.slug}`} className="block overflow-hidden border border-line bg-ink-800">
                  <div className="relative aspect-[16/10]">
                    {featured.coverUrl ? (
                      <Image
                        src={featured.coverUrl}
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 1024px) 92vw, 46vw"
                        className="object-cover transition-transform duration-700 ease-tech group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                </Link>
                <div className="flex flex-col justify-center">
                  <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                    {featured.tags[0] ?? 'Nota'} · {formatDate(featured.publishedAt)} ·{' '}
                    {readingMinutes(featured.body)} min de lectura
                  </p>
                  <h2 className="mt-4 text-balance font-display text-[26px] leading-tight tracking-tightest text-chalk sm:text-[34px]">
                    <Link href={`/blog/${featured.slug}`} className="hover:accent-text">
                      {featured.title}
                    </Link>
                  </h2>
                  <p className="mt-4 text-pretty text-[15px] leading-relaxed text-chalk-dim">
                    {featured.excerpt}
                  </p>
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="mt-6 inline-block font-display text-[11px] font-semibold uppercase tracking-widest accent-text"
                  >
                    Leer la nota →
                  </Link>
                </div>
              </article>
            ) : null}

            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <article key={post.slug} className="group">
                  <Link href={`/blog/${post.slug}`} className="block overflow-hidden border border-line bg-ink-800">
                    <div className="relative aspect-[16/10]">
                      {post.coverUrl ? (
                        <Image
                          src={post.coverUrl}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 92vw, 30vw"
                          className="object-cover transition-transform duration-700 ease-tech group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                  </Link>
                  <p className="mt-5 font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                    {post.tags[0] ?? 'Nota'} · {formatDate(post.publishedAt)}
                  </p>
                  <h2 className="mt-2.5 font-display text-[18px] leading-tight tracking-tight text-chalk">
                    <Link href={`/blog/${post.slug}`} className="hover:accent-text">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-chalk-faint">
                    {post.excerpt}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
