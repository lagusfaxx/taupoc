import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { readingMinutes } from '@/lib/markdown';
import { PageHeader } from '@/components/admin/PageHeader';
import { Table, Td, Th, Tr } from '@/components/admin/Table';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Blog', noIndex: true });

export default async function AdminBlogPage() {
  await requireAdmin();
  const posts = await prisma.post.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });

  return (
    <>
      <PageHeader
        title="Blog"
        description="Guías técnicas, normativa y resultados. El contenido del blog es lo que trae tráfico orgánico."
        actions={
          <ButtonLink href="/admin/blog/nuevo" size="sm">
            <IconPlus className="h-4 w-4" />
            Nueva nota
          </ButtonLink>
        }
      />

      <div className="border border-line bg-ink-900">
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>Nota</Th>
              <Th>Estado</Th>
              <Th>Etiquetas</Th>
              <Th>Publicada</Th>
              <Th align="right">Lectura</Th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <Tr key={post.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="relative h-11 w-16 shrink-0 overflow-hidden border border-line bg-ink-800">
                      {post.coverUrl ? (
                        <Image src={post.coverUrl} alt="" fill sizes="64px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/admin/blog/${post.id}`} className="block truncate text-chalk hover:accent-text">
                        {post.title}
                      </Link>
                      <span className="block truncate text-[11.5px] text-chalk-faint">/blog/{post.slug}</span>
                    </span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={post.status === 'PUBLISHED' ? 'ok' : 'muted'}>
                    {post.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
                  </Badge>
                </Td>
                <Td>{post.tags.join(', ') || '—'}</Td>
                <Td>{post.publishedAt ? formatDate(post.publishedAt) : '—'}</Td>
                <Td align="right">{readingMinutes(post.body)} min</Td>
              </Tr>
            ))}
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13.5px] text-chalk-faint">
                  Todavía no hay notas publicadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </>
  );
}
