import { formatDate } from '@/lib/utils';
import { Stars } from '@/components/ui/Stars';
import { Reveal } from '@/components/ui/Reveal';
import { IconCheck } from '@/components/ui/Icons';

export interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorNote: string | null;
  verified: boolean;
  publishedAt: Date;
}

/** Cuántas reseñas hay de cada nota, de 5 a 1. */
function distribucion(reviews: ReviewData[]): { nota: number; total: number; pct: number }[] {
  return [5, 4, 3, 2, 1].map((nota) => {
    const total = reviews.filter((r) => r.rating === nota).length;
    return { nota, total, pct: reviews.length ? (total / reviews.length) * 100 : 0 };
  });
}

export function ProductReviews({
  reviews,
  average,
  productName,
}: {
  reviews: ReviewData[];
  average: number;
  productName: string;
}) {
  if (reviews.length === 0) return null;

  return (
    <section id="opiniones" className="border-t border-line scroll-mt-24">
      <div className="container py-14 lg:py-20">
        <p className="eyebrow-accent mb-4">Opiniones</p>
        <h2 className="font-display text-[26px] leading-tight tracking-tight text-chalk sm:text-[32px]">
          Qué dicen quienes ya nadan con el {productName}
        </h2>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16">
          {/* Resumen */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[52px] leading-none tracking-tightest text-chalk">
                {average.toFixed(1).replace('.', ',')}
              </span>
              <span className="text-[14px] text-chalk-faint">de 5</span>
            </div>

            <Stars value={average} size="lg" className="mt-3" />

            <p className="mt-2.5 text-[13.5px] text-chalk-dim">
              {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
            </p>

            <dl className="mt-6 space-y-1.5">
              {distribucion(reviews).map((fila) => (
                <div key={fila.nota} className="flex items-center gap-3">
                  <dt className="w-7 shrink-0 text-right font-mono text-[12px] text-chalk-faint">
                    {fila.nota}★
                  </dt>
                  <dd className="flex flex-1 items-center gap-3">
                    <span className="h-1.5 flex-1 bg-ink-700">
                      <span
                        className="block h-full accent-bg transition-[width] duration-700 ease-tech"
                        style={{ width: `${fila.pct}%` }}
                      />
                    </span>
                    <span className="w-5 shrink-0 text-right font-mono text-[12px] text-chalk-faint">
                      {fila.total}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Listado */}
          <ul className="divide-y divide-line">
            {reviews.map((review, i) => (
              <li key={review.id} className="py-6 first:pt-0">
                <Reveal delay={Math.min(i, 4) * 70}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Stars value={review.rating} size="sm" />
                  <span className="sr-only">{review.rating} de 5</span>
                  <span className="font-display text-[13px] font-semibold uppercase tracking-widest text-chalk">
                    {review.authorName}
                  </span>
                  {review.verified ? (
                    <span className="inline-flex items-center gap-1 border border-signal-ok/40 bg-signal-ok/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-signal-ok">
                      <IconCheck className="h-3 w-3" />
                      Compra verificada
                    </span>
                  ) : null}
                </div>

                {review.authorNote ? (
                  <p className="mt-1 text-[12.5px] text-chalk-faint">{review.authorNote}</p>
                ) : null}

                {review.title ? (
                  <p className="mt-3 font-display text-[16px] leading-snug text-chalk">{review.title}</p>
                ) : null}

                {review.body ? (
                  <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-chalk-dim">
                    {review.body}
                  </p>
                ) : null}

                <p className="mt-3 text-[12px] text-chalk-faint">{formatDate(review.publishedAt)}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
