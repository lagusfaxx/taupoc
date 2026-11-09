import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { findOrderByReviewToken } from '@/lib/review-requests';
import { OrderReviewForm, type ReviewableProduct } from '@/components/store/OrderReviewForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Califica tu compra',
  path: '/calificar',
  noIndex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Enlace público del correo que pide calificar. El token prueba la compra,
 * así que no hace falta iniciar sesión. Las estrellas del correo llegan como
 * `?p=<producto>&n=<nota>` y dejan esa nota marcada.
 */
export default async function RateOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const query = await searchParams;
  const one = (k: string) => (Array.isArray(query[k]) ? query[k]![0] : query[k]) as string | undefined;

  const order = await findOrderByReviewToken(token);
  if (!order) notFound();

  const calificados = new Map(order.reviews.map((r) => [r.productId, r.rating]));
  const vistos = new Set<string>();
  const products: ReviewableProduct[] = order.items.flatMap((item) => {
    if (!item.product || vistos.has(item.product.id)) return [];
    vistos.add(item.product.id);
    const detail = [item.colorName, item.size && item.size !== 'U' ? `Talla ${item.size}` : null]
      .filter(Boolean)
      .join(' · ');
    return [{
      id: item.product.id,
      name: item.productName,
      detail: detail || null,
      imageUrl: item.imageUrl,
      rated: calificados.get(item.product.id) ?? null,
    }];
  });
  if (products.length === 0) notFound();

  const nota = Number(one('n'));
  const preselect = one('p') && nota >= 1 && nota <= 5 ? { productId: one('p')!, rating: Math.round(nota) } : null;

  const defaultName = [order.firstName?.trim(), order.lastName?.trim()?.charAt(0)]
    .filter(Boolean)
    .join(' ')
    .concat(order.lastName?.trim() ? '.' : '');

  return (
    <div className="container py-14 lg:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow-accent mb-4">Pedido {order.number}</p>
        <h1 className="font-display text-[28px] leading-tight tracking-tight text-chalk sm:text-[36px]">
          ¿Qué te pareció tu compra?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chalk-dim">
          Marca las estrellas de cada producto. El comentario es opcional, pero ayuda mucho a
          quien está eligiendo modelo y talla.
        </p>

        <OrderReviewForm
          token={token}
          products={products}
          preselect={preselect}
          defaultName={defaultName}
        />

        <p className="mt-8 text-[13px] text-chalk-faint">
          ¿Tuviste un problema con el pedido?{' '}
          <Link href="/contacto" className="underline underline-offset-4">Escríbenos</Link> y lo vemos contigo.
        </p>
      </div>
    </div>
  );
}
