import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { PostForm } from '@/components/admin/PostForm';
import { IconExternal } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Editar nota', noIndex: true });

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.title}
        back={{ href: '/admin/blog', label: 'Blog' }}
        actions={
          post.status === 'PUBLISHED' ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="inline-flex h-9 items-center gap-2 border border-line px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
            >
              <IconExternal className="h-3.5 w-3.5" />
              Ver en la tienda
            </Link>
          ) : null
        }
      />
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          tags: post.tags.join(', '),
          author: post.author,
          status: post.status,
          coverUrl: post.coverUrl,
          seoTitle: post.seoTitle ?? '',
          seoDescription: post.seoDescription ?? '',
        }}
      />
    </>
  );
}
