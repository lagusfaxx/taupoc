'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { storeImage, deleteImage } from '@/lib/uploads';
import type { AdminState } from './products';

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Ingresa un título.'),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  tags: z.string().optional(),
  author: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

function revalidateBlog(slug?: string) {
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath('/');
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function savePost(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }
  const d = parsed.data;
  const slug = slugify(d.slug || d.title);

  const clash = await prisma.post.findFirst({
    where: { slug, ...(d.id ? { NOT: { id: d.id } } : {}) },
  });
  if (clash) return { ok: false, message: 'Ya existe otra nota con esa URL.' };

  let coverUrl: string | undefined;
  const cover = formData.get('cover');
  if (cover instanceof File && cover.size > 0) {
    try {
      const stored = await storeImage(cover);
      coverUrl = stored.url;
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo subir la portada.' };
    }
  }

  const existing = d.id ? await prisma.post.findUnique({ where: { id: d.id } }) : null;

  const data = {
    title: d.title.trim(),
    slug,
    excerpt: d.excerpt?.trim() ?? '',
    body: d.body ?? '',
    tags: (d.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    author: d.author?.trim() || 'Equipo TAUPOC Chile',
    status: d.status,
    seoTitle: d.seoTitle?.trim() || null,
    seoDescription: d.seoDescription?.trim() || null,
    ...(coverUrl ? { coverUrl } : {}),
      ...(d.status === 'PUBLISHED' && !existing?.publishedAt ? { publishedAt: new Date() } : {}),
  };

  if (d.id) {
    if (coverUrl && existing?.coverUrl) await deleteImage(existing.coverUrl);
    const post = await prisma.post.update({ where: { id: d.id }, data });
    revalidateBlog(post.slug);
    return { ok: true, message: 'Nota guardada.', id: post.id };
  }

  const post = await prisma.post.create({ data });
  revalidateBlog(post.slug);
  redirect(`/admin/blog/${post.id}?creado=1`);
}

export async function togglePostStatus(id: string) {
  await requireAdmin();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  const status = post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  await prisma.post.update({
    where: { id },
    data: { status, ...(status === 'PUBLISHED' && !post.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  revalidateBlog(post.slug);
}

export async function deletePost(id: string) {
  await requireAdmin();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  await prisma.post.delete({ where: { id } });
  if (post.coverUrl) await deleteImage(post.coverUrl);
  revalidateBlog(post.slug);
  redirect('/admin/blog?eliminado=1');
}
