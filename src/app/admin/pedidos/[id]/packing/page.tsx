import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { regionName } from '@/lib/chile';
import { buildMetadata } from '@/lib/seo';
import { PrintButton } from '@/components/admin/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Packing slip', noIndex: true });

/**
 * Documento de empaque para imprimir junto al pedido.
 * Se renderiza en claro: se imprime en papel, no se mira en pantalla.
 */
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: true } }),
    getSettings(),
  ]);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-white p-8 text-black print:p-0">
      <style>{`@media print { @page { margin: 14mm; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6 flex items-center justify-between border-b border-neutral-300 pb-4">
        <p className="text-sm text-neutral-600">
          Vista de impresión. Usa el botón para enviar a la impresora o guardar como PDF.
        </p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-black pb-5">
        <div>
          <p className="text-2xl font-black tracking-[0.22em]">TAUPOC</p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.3em] text-neutral-600">CHILE</p>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-700">
            {settings.addressLine}<br />
            {settings.contactEmail} · {settings.contactPhone}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-600">
            Guía de empaque
          </p>
          <p className="mt-1 text-3xl font-black">{order.number}</p>
          <p className="mt-1 text-[12px] text-neutral-700">{formatDate(order.createdAt)}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Despachar a</p>
          <p className="mt-2 text-[14px] font-semibold">{order.firstName} {order.lastName}</p>
          {order.isPickup ? (
            <p className="mt-1 text-[13px] leading-relaxed">
              {order.shippingLabel}<br />
              Coordinado directamente con el cliente.
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed">
              {[order.street, order.streetNumber].filter(Boolean).join(' ')}
              {order.addressExtra ? `, ${order.addressExtra}` : ''}<br />
              {order.commune}, {regionName(order.region)}<br />
              {order.postalCode ? `CP ${order.postalCode}` : ''}
            </p>
          )}
          <p className="mt-2 text-[13px]">{order.phone}</p>
          <p className="text-[13px]">{order.email}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Envío</p>
          <p className="mt-2 text-[14px] font-semibold">{order.shippingLabel}</p>
          <p className="mt-1 text-[13px]">{order.shippingCarrier}</p>
          {order.trackingNumber ? (
            <p className="mt-2 font-mono text-[15px] font-bold">{order.trackingNumber}</p>
          ) : (
            <p className="mt-2 text-[13px] text-neutral-500">Sin número de seguimiento aún</p>
          )}
        </div>
      </section>

      <table className="mt-8 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em]">Producto</th>
            <th className="py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em]">SKU</th>
            <th className="py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em]">Talla</th>
            <th className="py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em]">Cant.</th>
            <th className="py-2 text-right text-[10px] font-bold uppercase tracking-[0.15em]">Total</th>
            <th className="w-10 py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em]">✓</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-300">
              <td className="py-2.5">
                <span className="font-semibold">{item.productName}</span>
                <br />
                <span className="text-neutral-600">{item.colorName}</span>
              </td>
              <td className="py-2.5 font-mono text-[12px]">{item.sku}</td>
              <td className="py-2.5 text-center text-[15px] font-bold">{item.size}</td>
              <td className="py-2.5 text-center font-semibold">{item.quantity}</td>
              <td className="py-2.5 text-right">{formatCLP(item.lineTotal)}</td>
              <td className="py-2.5 text-center">
                <span className="inline-block h-4 w-4 border border-black" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <table className="text-[13px]">
          <tbody>
            <tr>
              <td className="py-1 pr-8 text-neutral-600">Subtotal</td>
              <td className="py-1 text-right">{formatCLP(order.subtotal)}</td>
            </tr>
            {order.discountTotal > 0 ? (
              <tr>
                <td className="py-1 pr-8 text-neutral-600">Descuento {order.couponCode ?? ''}</td>
                <td className="py-1 text-right">−{formatCLP(order.discountTotal)}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 pr-8 text-neutral-600">Despacho</td>
              <td className="py-1 text-right">
                {order.shippingTotal > 0 ? formatCLP(order.shippingTotal) : 'Gratis'}
              </td>
            </tr>
            <tr className="border-t-2 border-black">
              <td className="py-2 pr-8 font-bold">TOTAL</td>
              <td className="py-2 text-right text-[18px] font-black">{formatCLP(order.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {order.customerNote ? (
        <div className="mt-6 border-l-4 border-black pl-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Nota del cliente</p>
          <p className="mt-1 text-[13px]">{order.customerNote}</p>
        </div>
      ) : null}

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-600">
        <p className="font-semibold text-black">Antes de nadar con tu traje nuevo</p>
        <p className="mt-1">
          Ponlo con las palmas abiertas, nunca con las uñas. Enjuágalo con agua fría después de cada uso
          y sécalo a la sombra, extendido. Cambio de talla sin costo dentro de 10 días, sin uso y con
          etiqueta: escríbenos a {settings.contactEmail}.
        </p>
      </footer>
    </div>
  );
}
