'use client';

import Image from 'next/image';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { deletePost, savePost } from '@/actions/admin/posts';
import type { AdminState } from '@/actions/admin/products';
import { slugify, cn } from '@/lib/utils';
import { Card } from './Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { IconTrash } from '@/components/ui/Icons';

export interface PostFormData {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tags: string;
  author: string;
  status: string;
  coverUrl: string | null;
  seoTitle: string;
  seoDescription: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full accent-bg px-6 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

export function PostForm({ post }: { post: PostFormData }) {
  const [state, action] = useActionState<AdminState | null, FormData>(savePost, null);
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(post.slug));
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const autoSlug = slugTouched ? slug : slugify(title);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      {post.id ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="space-y-5">
        {state ? (
          <p
            role="status"
            className={cn(
              'border px-3.5 py-2.5 text-[13.5px]',
              state.ok
                ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
            )}
          >
            {state.message}
          </p>
        ) : null}

        <Card title="Contenido">
          <div className="space-y-4">
            <Input
              label="Título"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="URL"
              name="slug"
              value={autoSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              help={`taupoc.cl/blog/${autoSlug || '…'}`}
            />
            <Textarea
              label="Bajada"
              name="excerpt"
              rows={3}
              defaultValue={post.excerpt}
              help="Se muestra en la portada del blog y en los resultados de búsqueda."
            />
            <Textarea
              label="Cuerpo de la nota"
              name="body"
              rows={22}
              defaultValue={post.body}
              className="font-mono"
              help="Acepta markdown: ## para títulos, **negrita**, listas con guiones y tablas."
            />
          </div>
        </Card>

        <Card title="SEO">
          <div className="space-y-4">
            <Input label="Título SEO" name="seoTitle" defaultValue={post.seoTitle} />
            <Textarea label="Descripción SEO" name="seoDescription" rows={3} defaultValue={post.seoDescription} />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Publicación">
          <div className="space-y-4">
            <Select label="Estado" name="status" defaultValue={post.status || 'DRAFT'}>
              <option value="DRAFT">Borrador</option>
              <option value="PUBLISHED">Publicada</option>
            </Select>
            <Input label="Autor" name="author" defaultValue={post.author || 'Equipo TAUPOC Chile'} />
            <Input
              label="Etiquetas"
              name="tags"
              defaultValue={post.tags}
              placeholder="Guías, Tallas"
              help="Sepáralas con comas."
            />
          </div>
        </Card>

        <Card title="Imagen de portada">
          {preview || post.coverUrl ? (
            <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden border border-line bg-ink-800">
              <Image src={preview ?? post.coverUrl!} alt="" fill sizes="360px" className="object-cover" />
            </div>
          ) : null}
          <input
            type="file"
            name="cover"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="w-full text-[13px] text-chalk-dim file:mr-3 file:border file:border-line-bright file:bg-ink-800 file:px-3 file:py-2 file:font-display file:text-[10.5px] file:uppercase file:tracking-widest file:text-chalk"
          />
          <p className="mt-2 text-[12px] text-chalk-faint">
            Ideal 1600 × 900 px. Se convierte a WEBP automáticamente.
          </p>
        </Card>

        <div className="sticky bottom-4 space-y-3 border border-line bg-ink-900 p-4">
          <Submit label={post.id ? 'Guardar nota' : 'Crear nota'} />
          {post.id ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm('¿Eliminar esta nota? No se puede deshacer.')) {
                  startTransition(async () => {
                    await deletePost(post.id!);
                  });
                }
              }}
              className="flex w-full items-center justify-center gap-2 border border-signal-bad/40 py-2.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-signal-bad transition hover:bg-signal-bad/10 disabled:opacity-50"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Eliminar nota
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
