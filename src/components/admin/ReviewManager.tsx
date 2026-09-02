'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteReview, saveReview, toggleReviewStatus } from '@/actions/admin/reviews';
import type { AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Stars } from '@/components/ui/Stars';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Field';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorNote: string | null;
  verified: boolean;
  status: 'PUBLISHED' | 'HIDDEN';
  publishedAt: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function ReviewFields({
  productId,
  review,
  onDone,
}: {
  productId: string;
  review?: ReviewRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(async (prev, fd) => {
    const res = await saveReview(prev, fd);
    if (res.ok) onDone();
    return res;
  }, null);

  return (
    <form action={action} className="grid gap-4 border border-line bg-ink-900 p-5">
      <input type="hidden" name="productId" value={productId} />
      {review ? <input type="hidden" name="id" value={review.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[120px_1fr_180px]">
        <Select label="Nota" name="rating" defaultValue={String(review?.rating ?? 5)}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </Select>

        <Input
          label="Quién la dejó"
          name="authorName"
          required
          maxLength={80}
          defaultValue={review?.authorName ?? ''}
          placeholder="Camila R."
        />

        <Input
          label="Fecha"
          name="publishedAt"
          type="date"
          defaultValue={review?.publishedAt ?? new Date().toISOString().slice(0, 10)}
          help="Cuándo la dejó de verdad."
        />
      </div>

      <Input
        label="Contexto"
        name="authorNote"
        maxLength={120}
        defaultValue={review?.authorNote ?? ''}
        placeholder="Club Manquehue · categoría juvenil"
        help="Opcional. Da contexto sin exponer al cliente."
      />

      <Input
        label="Título"
        name="title"
        maxLength={120}
        defaultValue={review?.title ?? ''}
        placeholder="Bajé dos décimas en los 100 libre"
      />

      <Textarea
        label="Opinión"
        name="body"
        rows={4}
        maxLength={4000}
        defaultValue={review?.body ?? ''}
        placeholder="Transcribe lo que dijo el cliente."
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <Checkbox
            label="Compra verificada"
            name="verified"
            defaultChecked={review?.verified ?? false}
          />
          <Select label="Estado" name="status" defaultValue={review?.status ?? 'PUBLISHED'}>
            <option value="PUBLISHED">Publicada</option>
            <option value="HIDDEN">Oculta</option>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDone}
            className="h-10 border border-line-bright px-4 font-display text-[11px] font-bold uppercase tracking-widest text-chalk-dim transition hover:text-chalk"
          >
            Cancelar
          </button>
          <Submit label={review ? 'Guardar cambios' : 'Agregar opinión'} />
        </div>
      </div>

      {state && !state.ok ? (
        <p role="status" className="border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ReviewManager({
  productId,
  reviews,
}: {
  productId: string;
  reviews: ReviewRow[];
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const publicadas = reviews.filter((r) => r.status === 'PUBLISHED');
  const promedio = publicadas.length
    ? publicadas.reduce((s, r) => s + r.rating, 0) / publicadas.length
    : 0;

  return (
    <div className={cn('space-y-5', pendiente && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-ink-900 p-5">
        <div className="flex items-center gap-4">
          <span className="font-display text-[34px] leading-none tracking-tightest text-chalk">
            {publicadas.length ? promedio.toFixed(1).replace('.', ',') : '—'}
          </span>
          <div>
            <Stars value={promedio} size="md" />
            <p className="mt-1.5 text-[12.5px] text-chalk-faint">
              {publicadas.length} {publicadas.length === 1 ? 'publicada' : 'publicadas'}
              {reviews.length - publicadas.length > 0
                ? ` · ${reviews.length - publicadas.length} oculta(s)`
                : ''}
            </p>
          </div>
        </div>

        {!creando ? (
          <button
            type="button"
            onClick={() => {
              setCreando(true);
              setEditando(null);
            }}
            className="inline-flex h-10 items-center gap-2 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Agregar opinión
          </button>
        ) : null}
      </div>

      <p className="border-l-2 border-line-bright bg-ink-900 px-4 py-3 text-[13px] leading-relaxed text-chalk-faint">
        Estas opiniones se declaran ante Google en el marcado de la ficha. Carga solo las que un
        cliente dejó de verdad —por WhatsApp, Instagram o en el stand—; inventar notas expone la
        tienda a una sanción manual de Google además de engañar a quien compra.
      </p>

      {creando ? (
        <ReviewFields
          productId={productId}
          onDone={() => {
            setCreando(false);
            router.refresh();
          }}
        />
      ) : null}

      {reviews.length === 0 && !creando ? (
        <p className="border border-dashed border-line px-5 py-8 text-center text-[13.5px] text-chalk-faint">
          Sin opiniones todavía. Agrega las que tengas de este producto.
        </p>
      ) : null}

      <ul className="space-y-3">
        {reviews.map((review) =>
          editando === review.id ? (
            <li key={review.id}>
              <ReviewFields
                productId={productId}
                review={review}
                onDone={() => {
                  setEditando(null);
                  router.refresh();
                }}
              />
            </li>
          ) : (
            <li key={review.id} className="border border-line bg-ink-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Stars value={review.rating} size="sm" />
                    <span className="font-display text-[13px] font-semibold uppercase tracking-widest text-chalk">
                      {review.authorName}
                    </span>
                    {review.verified ? <Badge tone="ok">Verificada</Badge> : null}
                    {review.status === 'HIDDEN' ? <Badge tone="muted">Oculta</Badge> : null}
                    <span className="text-[12px] text-chalk-faint">
                      {formatDate(review.publishedAt)}
                    </span>
                  </div>

                  {review.authorNote ? (
                    <p className="mt-1 text-[12.5px] text-chalk-faint">{review.authorNote}</p>
                  ) : null}
                  {review.title ? (
                    <p className="mt-2 text-[14px] font-semibold text-chalk">{review.title}</p>
                  ) : null}
                  {review.body ? (
                    <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-chalk-dim">
                      {review.body}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(review.id);
                      setCreando(false);
                    }}
                    className="h-9 border border-line-bright px-3 font-display text-[10.5px] font-bold uppercase tracking-widest text-chalk-dim transition hover:text-chalk"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(async () => {
                      await toggleReviewStatus(review.id);
                      router.refresh();
                    })}
                    className="h-9 border border-line-bright px-3 font-display text-[10.5px] font-bold uppercase tracking-widest text-chalk-dim transition hover:text-chalk"
                  >
                    {review.status === 'PUBLISHED' ? 'Ocultar' : 'Publicar'}
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar opinión"
                    onClick={() => {
                      if (!confirm(`¿Eliminar la opinión de ${review.authorName}?`)) return;
                      startTransition(async () => {
                        await deleteReview(review.id);
                        router.refresh();
                      });
                    }}
                    className="flex h-9 w-9 items-center justify-center border border-line-bright text-chalk-faint transition hover:border-signal-bad hover:text-signal-bad"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
