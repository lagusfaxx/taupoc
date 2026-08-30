import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { absoluteUrl, buildMetadata, jsonLd } from '@/lib/seo';
import { formatDate } from '@/lib/utils';
import { readingMinutes, renderMarkdown } from '@/lib/markdown';
import { NewsletterForm } from '@/components/store/NewsletterForm';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug, status: 'PUBLISHED' } });
  if (!post) return buildMetadata({ title: 'Nota no encontrada', noIndex: true });

  return buildMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.coverUrl,
    type: 'article',
    publishedTime: post.publishedAt?.toISOString(),
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug, status: 'PUBLISHED' } });
  if (!post) notFound();

  const related = await prisma.post.findMany({
    where: { status: 'PUBLISHED', slug: { not: post.slug } },
    orderBy: { publishedAt: 'desc' },
    take: 2,
  });

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverUrl ? [absoluteUrl(post.coverUrl)] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'TAUPOC Chile' },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />

      <article>
        <header className="border-b border-line bg-ink-900">
          <div className="container py-12 lg:py-16">
            <Link href="/blog" className="font-display text-[11px] uppercase tracking-widest text-chalk-faint hover:text-chalk">
              ← Blog
            </Link>
            <div className="mt-6 max-w-3xl">
              <p className="font-display text-[10px] uppercase tracking-mega accent-text">
                {post.tags.join(' · ') || 'Nota'}
              </p>
              <h1 className="mt-4 text-balance font-display text-[32px] leading-[1.02] tracking-tightest text-chalk sm:text-[46px]">
                {post.title}
              </h1>
              <p className="mt-5 text-pretty text-[16px] leading-relaxed text-chalk-dim">{post.excerpt}</p>
              <p className="mt-6 text-[13px] text-chalk-faint">
                {post.author} · {formatDate(post.publishedAt)} · {readingMinutes(post.body)} min de lectura
              </p>
            </div>
          </div>
        </header>

        {post.coverUrl ? (
          <div className="container -mt-px">
            <div className="relative aspect-[21/9] w-full overflow-hidden border-x border-b border-line bg-ink-800">
              <Image src={post.coverUrl} alt="" fill priority sizes="100vw" className="object-cover" />
            </div>
          </div>
        ) : null}

        <div className="container py-12 lg:py-16">
          <div
            className="prose-taupoc mx-auto max-w-2xl"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
          />

          <div className="mx-auto mt-14 max-w-2xl border-t border-line pt-10">
            <h2 className="font-display text-[16px] uppercase tracking-widest text-chalk">
              Resultados, stock y torneos
            </h2>
            <p className="mt-2 text-[14px] text-chalk-faint">
              Avisos de reposición de tallas y fechas de stand. Sin spam.
            </p>
            <div className="mt-5">
              <NewsletterForm source="blog" />
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-line bg-ink-900">
          <div className="container py-14">
            <h2 className="mb-8 font-display text-[16px] uppercase tracking-widest text-chalk">
              Seguir leyendo
            </h2>
            <div className="grid gap-8 md:grid-cols-2">
              {related.map((item) => (
                <article key={item.slug} className="group flex gap-5">
                  <Link href={`/blog/${item.slug}`} className="relative h-24 w-32 shrink-0 overflow-hidden border border-line bg-ink-800">
                    {item.coverUrl ? (
                      <Image src={item.coverUrl} alt="" fill sizes="128px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : null}
                  </Link>
                  <div>
                    <p className="font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                      {formatDate(item.publishedAt)}
                    </p>
                    <h3 className="mt-1.5 font-display text-[15px] leading-tight tracking-tight text-chalk">
                      <Link href={`/blog/${item.slug}`} className="hover:accent-text">{item.title}</Link>
                    </h3>
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
