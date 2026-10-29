'use client';
import { useActionState, useState } from 'react';
import { submitAdminOrder } from '@/actions/admin/create-order';
import { formatCLP } from '@/lib/money';
import { REGIONS } from '@/lib/chile';
import { Card } from './Card';

type Variant = { id: string; label: string; price: number; stock: number };
const input = 'mt-1 w-full border border-line bg-ink-800 p-3 text-sm text-chalk';
export function CreateOrderForm({
  creationKey,
  variants,
}: {
  creationKey: string;
  variants: Variant[];
}) {
  const [state, action, pending] = useActionState(submitAdminOrder, null);
  const [items, setItems] = useState<{ variantId: string; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [delivery, setDelivery] = useState('pickup');
  const [shippingLabel, setShippingLabel] = useState('Retiro coordinado');
  const [region, setRegion] = useState('RM');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const subtotal = items.reduce(
    (s, i) => s + (variants.find((v) => v.id === i.variantId)?.price ?? 0) * i.quantity,
    0,
  );
  function add(id: string) {
    setItems((old) =>
      old.some((i) => i.variantId === id)
        ? old.map((i) =>
            i.variantId === id ? { ...i, quantity: Math.min(100, i.quantity + 1) } : i,
          )
        : [...old, { variantId: id, quantity: 1 }],
    );
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="creationKey" value={creationKey} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        <Card title="Productos">
          <label className="text-sm">
            Buscar producto, talla o SKU
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos"
            />
          </label>
          <div className="mt-3 max-h-64 overflow-auto border border-line">
            {variants
              .filter((v) => v.label.toLowerCase().includes(search.toLowerCase()))
              .map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 border-b border-line p-3 text-sm"
                >
                  <span>
                    {v.label}
                    <span className="block text-chalk-faint">
                      {formatCLP(v.price)} · Stock disponible: {v.stock}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => add(v.id)}
                    disabled={items.length >= 50 && !items.some((i) => i.variantId === v.id)}
                    className="accent-text p-2"
                  >
                    Agregar
                  </button>
                </div>
              ))}
          </div>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-chalk-faint">Agrega productos al pedido.</p>
          ) : (
            items.map((i) => {
              const v = variants.find((v) => v.id === i.variantId)!;
              return (
                <div
                  key={i.variantId}
                  className="mt-3 flex flex-wrap items-center gap-3 border border-line p-3 text-sm"
                >
                  <span className="min-w-48 flex-1">
                    {v.label}
                    {i.quantity > v.stock ? (
                      <span className="block text-signal-warn">
                        Faltan {i.quantity - Math.max(0, v.stock)} unidades de stock para este
                        pedido.
                      </span>
                    ) : null}
                  </span>
                  <label>
                    Cantidad
                    <input
                      aria-label={`Cantidad ${v.label}`}
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={i.quantity}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((item) =>
                            item.variantId === i.variantId
                              ? { ...item, quantity: Number(e.target.value) }
                              : item,
                          ),
                        )
                      }
                      className={`${input} max-w-24`}
                    />
                  </label>
                  <span>{formatCLP(v.price * i.quantity)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((old) => old.filter((item) => item.variantId !== i.variantId))
                    }
                  >
                    Quitar
                  </button>
                </div>
              );
            })
          )}
        </Card>
        <Card title="Cliente">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['firstName', 'Nombre', 'text'],
              ['lastName', 'Apellido', 'text'],
              ['email', 'Correo', 'email'],
              ['phone', 'Teléfono', 'tel'],
            ].map(([name, label, type]) => (
              <label key={name} className="text-sm">
                {label}
                <input name={name} type={type} required className={input} />
              </label>
            ))}
          </div>
        </Card>
        <Card title="Entrega">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Tipo de entrega
              <select
                name="delivery"
                value={delivery}
                onChange={(e) => {
                  setDelivery(e.target.value);
                  setShippingLabel(e.target.value === 'pickup' ? 'Retiro coordinado' : 'Despacho');
                }}
                className={input}
              >
                <option value="pickup">Retiro</option>
                <option value="shipping">Despacho</option>
              </select>
            </label>
            <label className="text-sm">
              Forma de entrega
              <input
                name="shippingLabel"
                required
                value={shippingLabel}
                onChange={(e) => setShippingLabel(e.target.value)}
                className={input}
              />
            </label>
            <label className="text-sm">
              Courier
              <input name="shippingCarrier" className={input} />
            </label>
            <label className="text-sm">
              Costo de entrega (CLP)
              <input
                name="shippingTotal"
                type="number"
                min={0}
                max={100000000}
                required
                value={shipping}
                onChange={(e) => setShipping(Number(e.target.value))}
                className={input}
              />
            </label>
            {delivery === 'shipping' ? (
              <>
                <label className="text-sm">
                  Región
                  <select
                    name="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={input}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Comuna
                  <select key={region} name="commune" required className={input}>
                    {REGIONS.find((r) => r.code === region)?.communes.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {[
                  ['street', 'Calle'],
                  ['streetNumber', 'Número'],
                  ['addressExtra', 'Departamento / referencia'],
                ].map(([name, label]) => (
                  <label key={name} className="text-sm">
                    {label}
                    <input name={name} required={name !== 'addressExtra'} className={input} />
                  </label>
                ))}
              </>
            ) : null}
            <label className="text-sm sm:col-span-2">
              Nota del cliente
              <textarea name="customerNote" maxLength={500} className={input} />
            </label>
          </div>
        </Card>
        <Card title="Resumen">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Descuento (CLP)
              <input
                name="discountTotal"
                type="number"
                min={0}
                max={subtotal}
                required
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="text-sm">
              Estado inicial
              <select name="status" className={input}>
                <option value="PENDING">Pendiente de pago</option>
                <option value="PAID">Pagado</option>
                <option value="PROCESSING">En preparación (pagado)</option>
              </select>
            </label>
          </div>
          <p className="mt-4 text-sm text-chalk-dim">
            Al confirmar el pago se descuenta el inventario. El stock negativo indica unidades
            pendientes de reposición.
          </p>
          <p className="mt-4 text-sm">Subtotal: {formatCLP(subtotal)}</p>
          <p className="mt-2 text-xl font-semibold accent-text">
            Total: {formatCLP(subtotal - discount + shipping)}
          </p>
          <p className="mt-3 text-sm text-chalk-dim">
            El cliente recibirá los correos de estado según los ajustes de notificaciones de la
            tienda.
          </p>
        </Card>
        <p role="alert" className="text-signal-bad">
          {state?.message}
        </p>
        <button
          type="submit"
          disabled={pending || items.length === 0}
          className="accent-bg px-6 py-3 font-semibold disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear pedido'}
        </button>
      </fieldset>
    </form>
  );
}
