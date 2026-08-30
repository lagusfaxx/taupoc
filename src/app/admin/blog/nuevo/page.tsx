import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { PostForm } from '@/components/admin/PostForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Nueva nota', noIndex: true });

export default async function NewPostPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Nueva nota" back={{ href: '/admin/blog', label: 'Blog' }} />
      <PostForm
        post={{
          title: '', slug: '', excerpt: '', body: '', tags: '',
          author: 'Equipo TAUPOC Chile', status: 'DRAFT', coverUrl: null,
          seoTitle: '', seoDescription: '',
        }}
      />
    </>
  );
}
