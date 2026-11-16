import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { formatDateTime } from '@/lib/utils';
import {
  fetchSupplierCatalog, getSupplierSyncStatus, suggestSupplierColor, suggestSupplierHandle,
  type SupplierProduct,
} from '@/lib/supplier';
import { saveSupplierLinks, syncSupplierNow } from '@/actions/admin/supplier';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, StatCard } from '@/components/admin/Card';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Fábrica', noIndex: true });

const control =
  'h-10 w-full min-w-0 border border-line bg-ink-900 px-3 text-[13.5px] text-chalk focus:border-line-bright';

export default async function SupplierPage() {
  await requireAdmin();

  let catalog: SupplierProduct[] = [];
  let catalogError: string | null = null;
  try {
    catalog = await fetchSupplierCatalog();
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'No se pudo leer la tienda del proveedor.';
  }

  const [status, products] = await Promise.all([
    getSupplierSyncStatus(),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON', 'DRAFT'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, modelCode: true, supplierHandle: true,
        colors: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, name: true, code: true, hex: true, supplierColor: true,
            variants: {
              where: { active: true },
              select: { size: true, stock: true, reserved: true },
            },
          },
        },
      },
    }),
  ]);
  const byHandle = new Map(catalog.map((p) => [p.handle, p]));

  return (
    <>
      <PageHeader
        title="Fábrica"
        description="Enlaza cada producto y color con la tienda B2B del proveedor. La tienda consulta sola qué tallas tiene la fábrica y solo ofrece a pedido las que sí tiene."
        actions={
          <form action={syncSupplierNow}>
            <button
              type="submit"
              className="h-9 border border-line px-3.5 font-display text-[10.5px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
            >
              Consultar ahora
            </button>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Última consulta"
          value={status.at ? formatDateTime(status.at) : 'Nunca'}
          hint="Se repite sola cada 30 minutos"
        />
        <StatCard label="Colores enlazados" value={String(status.linkedColors)} />
        <StatCard label="Tallas con stock en fábrica" value={String(status.available)} tone="ok" />
        <StatCard label="Tallas sin stock en fábrica" value={String(status.unavailable)} />
      </div>

      {catalogError || status.error ? (
        <p className="mb-6 border border-signal-warn/40 bg-signal-warn/10 px-4 py-3 text-[13.5px] text-signal-warn">
          No se pudo leer la tienda del proveedor: {catalogError ?? status.error} Se mantiene el último dato
          conocido.
        </p>
      ) : null}

      <form action={saveSupplierLinks} className="space-y-6">
        {products.map((product) => {
          const suggestedHandle = suggestSupplierHandle(product.name, catalog);
          const handle = product.supplierHandle ?? suggestedHandle ?? '';
          const supplier = byHandle.get(handle);
          return (
            <Card
              key={product.id}
              title={product.name}
              description={`Modelo ${product.modelCode}`}
              padded={false}
            >
              <div className="border-b border-line-soft px-5 py-4">
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-[12.5px] text-chalk-dim">
                    Producto en la tienda del proveedor
                    {!product.supplierHandle && suggestedHandle ? (
                      <span className="ml-2 text-signal-info">sugerido, sin guardar</span>
                    ) : null}
                  </span>
                  <select name={`handle:${product.id}`} defaultValue={handle} className={control}>
                    <option value="">Sin enlazar</option>
                    {catalog.map((p) => (
                      <option key={p.handle} value={p.handle}>{p.title}</option>
                    ))}
                    {handle && !supplier ? <option value={handle}>{handle} (ya no está en el proveedor)</option> : null}
                  </select>
                </label>
                {!supplier && handle === '' ? (
                  <p className="mt-2 text-[12.5px] text-chalk-faint">
                    Elige el producto y guarda: después aparecen sus colores para enlazarlos.
                  </p>
                ) : null}
              </div>

              {supplier ? (
                <ul className="divide-y divide-line-soft">
                  {product.colors.map((color) => {
                    const suggested = suggestSupplierColor(color, supplier.colors);
                    const value = color.supplierColor ?? suggested ?? '';
                    const rows = supplier.variants.filter((v) => v.color === value);
                    const sizes = [...color.variants].sort((a, b) => Number(a.size) - Number(b.size));
                    return (
                      <li key={color.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[220px_260px_minmax(0,1fr)] lg:items-center">
                        <p className="flex items-center gap-2.5 text-[13.5px] text-chalk">
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-line-bright"
                            style={{ background: color.hex }}
                            aria-hidden
                          />
                          {color.name}
                          {color.code ? <span className="font-mono text-[12px] text-chalk-faint">{color.code}</span> : null}
                        </p>

                        <label>
                          <span className="sr-only">Color del proveedor para {color.name}</span>
                          <select name={`color:${color.id}`} defaultValue={value} className={control}>
                            <option value="">Sin enlazar</option>
                            {supplier.colors.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {value && !supplier.colors.includes(value) ? (
                              <option value={value}>{value} (ya no está)</option>
                            ) : null}
                          </select>
                          {!color.supplierColor && suggested ? (
                            <span className="mt-1 block text-[11.5px] text-signal-info">Sugerido, sin guardar</span>
                          ) : null}
                        </label>

                        {value ? (
                          <ul className="flex flex-wrap gap-1.5" aria-label={`Tallas de ${color.name}`}>
                            {sizes.map((v) => {
                              const inStock = v.stock - v.reserved > 0;
                              const factory = rows.find((r) => r.size == null || r.size === v.size)?.available ?? false;
                              return (
                                <li
                                  key={v.size}
                                  title={`Talla ${v.size}: ${inStock ? 'en tu bodega' : factory ? 'en fábrica' : 'sin stock en fábrica'}`}
                                  className={cn(
                                    'flex min-w-[44px] flex-col items-center border px-1.5 py-1 text-center',
                                    inStock
                                      ? 'border-line text-chalk'
                                      : factory
                                        ? 'border-signal-info/50 text-chalk'
                                        : 'border-dashed border-line text-chalk-faint',
                                  )}
                                >
                                  <span className="font-display text-[13px] font-semibold">{v.size}</span>
                                  <span className="text-[9.5px] leading-tight">
                                    {inStock ? 'bodega' : factory ? 'fábrica' : 'no hay'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-[12.5px] text-chalk-faint">
                            Sin enlazar: sus tallas agotadas se ofrecen a pedido sin saber si la fábrica las tiene.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </Card>
          );
        })}

        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-4 border-t border-line bg-ink/95 px-1 py-4 backdrop-blur">
          <button
            type="submit"
            className="h-11 accent-bg px-6 font-display text-[12px] font-bold uppercase tracking-widest clip-notch-sm"
          >
            Guardar y consultar a fábrica
          </button>
          <p className="text-[12.5px] text-chalk-faint">
            Revisa los colores sugeridos antes de guardar: un color mal enlazado ofrecería tallas que la fábrica no tiene.
          </p>
        </div>
      </form>
    </>
  );
}
