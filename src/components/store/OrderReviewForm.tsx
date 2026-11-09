'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import { submitOrderReviews, type OrderReviewState } from '@/actions/order-review';
import { Input, Textarea } from '@/components/ui/Field';
import { Stars } from '@/components/ui/Stars';
import { IconCheck } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export interface ReviewableProduct {
  id: string;
  name: string;
  detail: string | null;
  imageUrl: string | null;
  /** Nota que ya dejó desde este pedido, si la dejó. */
  rated: number | null;
}

const NOTAS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-13 w-full accent-bg py-4 font-display text-[12px] font-bold uppercase tracking-widest transition-all clip-notch-sm hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-10"
    >
      {pending ? 'Enviando…' : 'Enviar opinión'}
    </button>
  );
}

/** Cinco radios con forma de estrella: accesible con teclado y lector de pantalla. */
function StarPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="mt-3">
      <legend className="sr-only">Nota de 1 a 5</legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer sr-only"
              />
              <span className="sr-only">{n} de 5</span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
                className={cn(
                  'h-8 w-8 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                  n <= shown ? 'accent-text' : 'text-line-bright',
                )}
              >
                <path d="M10 1.6l2.47 5.28 5.53.75-4.03 3.85 1.02 5.72L10 14.48l-4.99 2.72 1.02-5.72L2 7.63l5.53-.75z" />
              </svg>
            </label>
          ))}
        </div>
        <span className="text-[13px] text-chalk-faint">{shown ? NOTAS[shown] : 'Sin calificar'}</span>
      </div>
    </fieldset>
  );
}

export function OrderReviewForm({
  token,
  products,
  preselect,
  defaultName,
}: {
  token: string;
  products: ReviewableProduct[];
  preselect: { productId: string; rating: number } | null;
  defaultName: string;
}) {
  const [state, action] = useActionState<OrderReviewState | null, FormData>(submitOrderReviews, null);
  const [ratings, setRatings] = useState<Record<string, number>>(() =>
    preselect && products.some((p) => p.id === preselect.productId && p.rated === null)
      ? { [preselect.productId]: preselect.rating }
      : {},
  );

  const pendientes = products.filter((p) => p.rated === null);

  if (state?.ok || pendientes.length === 0) {
    return (
      <div className="surface mt-8 flex items-start gap-4 p-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-signal-ok/40 bg-signal-ok/10 text-signal-ok">
          <IconCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-[17px] tracking-tight text-chalk">¡Gracias por tu opinión!</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">
            {state?.message ?? 'Ya calificaste los productos de este pedido.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute h-0 w-0 opacity-0" />

      {state && !state.ok ? (
        <p role="alert" className="border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 text-[13.5px] text-signal-bad">
          {state.message}
        </p>
      ) : null}

      <ul className="space-y-4">
        {products.map((p) => (
          <li key={p.id} className="surface p-5 sm:p-6">
            <div className="flex items-center gap-4">
              {p.imageUrl ? (
                <span className="relative h-16 w-16 shrink-0 overflow-hidden bg-ink-800">
                  <Image src={p.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-[16px] leading-snug text-chalk">{p.name}</p>
                {p.detail ? <p className="mt-0.5 text-[13px] text-chalk-faint">{p.detail}</p> : null}
              </div>
            </div>

            {p.rated !== null ? (
              <p className="mt-4 flex items-center gap-2 text-[13.5px] text-chalk-dim">
                <Stars value={p.rated} size="md" /> Ya lo calificaste. ¡Gracias!
              </p>
            ) : (
              <>
                <StarPicker
                  name={`rating_${p.id}`}
                  value={ratings[p.id] ?? 0}
                  onChange={(n) => setRatings((r) => ({ ...r, [p.id]: n }))}
                />
                {ratings[p.id] ? (
                  <div className="mt-4 space-y-3">
                    <Input
                      label="Título"
                      hint="Opcional"
                      name={`title_${p.id}`}
                      maxLength={120}
                      placeholder="Ej.: Comprime bien y es cómodo"
                    />
                    <Textarea
                      label="Tu comentario"
                      hint="Opcional"
                      name={`body_${p.id}`}
                      rows={3}
                      maxLength={4000}
                      placeholder="¿Cómo te quedó la talla? ¿En qué pruebas lo usaste?"
                    />
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="surface grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Input
          label="Nombre a mostrar"
          name="authorName"
          required
          minLength={2}
          maxLength={80}
          defaultValue={defaultName}
          help="Así aparecerá junto a tu opinión."
        />
        <Input
          label="Club o ciudad"
          hint="Opcional"
          name="authorNote"
          maxLength={120}
          placeholder="Ej.: Club Natación Ñuñoa"
        />
      </div>

      <Submit />
    </form>
  );
}
