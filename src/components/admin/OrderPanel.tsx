'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  decideTransfer, refundOrder, saveOrderNote, saveTracking, updateOrderStatus, updateOrderItem,
} from '@/actions/admin/orders';
import type { AdminState } from '@/actions/admin/products';
import { ORDER_STATUS_LABEL } from '@/lib/order-labels';
import { formatCLP } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';

function Submit({ label, variant = 'accent' }: { label: string; variant?: 'accent' | 'outline' | 'danger' }) {
  const { pending } = useFormStatus();
  const classes =
    variant === 'accent'
      ? 'accent-bg hover:brightness-110'
      : variant === 'danger'
        ? 'border border-signal-bad/50 bg-signal-bad/10 text-signal-bad hover:bg-signal-bad/20'
        : 'border border-line-bright text-chalk hover:border-chalk';
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'h-10 px-5 font-display text-[11px] font-bold uppercase tracking-widest transition disabled:opacity-50',
        classes,
      )}
    >
      {pending ? 'Procesando…' : label}
    </button>
  );
}

function Status({ state }: { state: AdminState | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'mb-3 border px-3.5 py-2.5 text-[13px]',
        state.ok
          ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
          : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
      )}
    >
      {state.message}
    </p>
  );
}

export function OrderStatusForm({ orderId, status }: { orderId: string; status: string }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateOrderStatus, null);

  return (
    <Card title="Estado del pedido">
      <Status state={state} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Select key={status} label="Estado" name="status" defaultValue={status}>
          {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <p className="text-[12px] leading-relaxed text-chalk-faint">
          Marcar como pagado descuenta el stock. Cancelar o reembolsar lo devuelve al inventario.
          Marcar como despachado envía el correo de seguimiento al cliente.
        </p>
        <Submit label="Actualizar estado" />
      </form>
    </Card>
  );
}

/**
 * Confirmación de la transferencia. Solo aparece mientras el pedido la espera:
 * confirmar lo deja pagado y sigue el camino normal; rechazar lo cancela.
 */
export function TransferForm({ orderId, total }: { orderId: string; total: number }) {
  const [state, action] = useActionState<AdminState | null, FormData>(decideTransfer, null);

  return (
    <Card
      title="Transferencia por confirmar"
      description={`Revisa en el banco que llegó el abono de ${formatCLP(total)} antes de confirmar.`}
    >
      <Status state={state} />
      <form
        action={action}
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const message =
            submitter?.value === 'reject'
              ? '¿Rechazar la transferencia? El pedido se cancela y se avisa al cliente.'
              : `¿Confirmas que recibiste ${formatCLP(total)}? El pedido pasa a pagado, se descuenta el stock y se avisa al cliente.`;
          if (!confirm(message)) e.preventDefault();
        }}
        className="space-y-3"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <Input
          label="N° de operación o comentario"
          hint="opcional"
          name="reference"
          placeholder="Ej.: transferencia 0012345, Banco de Chile"
          help="Queda en el historial del pedido."
        />
        <div className="flex flex-wrap gap-2">
          <TransferButton value="confirm" label="Confirmar transferencia" variant="accent" />
          <TransferButton value="reject" label="Rechazar" variant="danger" />
        </div>
      </form>
    </Card>
  );
}

function TransferButton({ value, label, variant }: { value: string; label: string; variant: 'accent' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={value}
      disabled={pending}
      className={cn(
        'h-10 px-5 font-display text-[11px] font-bold uppercase tracking-widest transition disabled:opacity-50',
        variant === 'accent'
          ? 'accent-bg hover:brightness-110'
          : 'border border-signal-bad/50 bg-signal-bad/10 text-signal-bad hover:bg-signal-bad/20',
      )}
    >
      {pending ? 'Procesando…' : label}
    </button>
  );
}

export function TrackingForm({
  orderId,
  carrier,
  trackingNumber,
  isShipped,
}: {
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  isShipped: boolean;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveTracking, null);

  return (
    <Card title="Seguimiento del envío">
      <Status state={state} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Select key={carrier ?? 'default'} label="Courier" name="carrier" defaultValue={carrier ?? 'Chilexpress'}>
          {['Chilexpress', 'Starken', 'Correos de Chile', 'Blue Express', 'Retiro en tienda', 'Entrega en torneo'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input
          key={trackingNumber ?? 'empty'}
          label="Número de seguimiento"
          name="trackingNumber"
          required
          defaultValue={trackingNumber ?? ''}
          placeholder="123456789012"
        />
        {!isShipped ? (
          <Checkbox
            name="markShipped"
            defaultChecked
            label="Marcar el pedido como despachado y avisar al cliente por correo"
          />
        ) : null}
        <Submit label="Guardar seguimiento" />
      </form>
    </Card>
  );
}

export function OrderNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveOrderNote, null);

  return (
    <Card title="Nota interna" description="Solo la ve el equipo, nunca el cliente.">
      <Status state={state} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Textarea
          label="Nota"
          name="adminNote"
          rows={4}
          defaultValue={note ?? ''}
          placeholder="Ej.: cliente pidió entregar en el torneo del 12 de octubre."
        />
        <Submit label="Guardar nota" variant="outline" />
      </form>
    </Card>
  );
}

export type OrderItemRow = {
  id: string;
  productId: string | null;
  productName: string;
  colorName: string;
  size: string;
  sku: string;
};

export type AvailableVariant = {
  id: string;
  productId: string;
  productName: string;
  colorName: string;
  colorCode: string | null;
  size: string;
  sku: string;
  stock: number;
};

function ItemEditRow({
  orderId,
  item,
  variants,
}: {
  orderId: string;
  item: OrderItemRow;
  variants: AvailableVariant[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AdminState | null, FormData>(updateOrderItem, null);

  const productVariants = variants.filter((v) => v.productId === item.productId);

  return (
    <div className="border-b border-line-soft last:border-0">
      <div className="flex items-start justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] text-chalk">{item.productName}</p>
          <p className="text-[12px] text-chalk-faint">{item.colorName} · Talla {item.size}</p>
          <p className="font-mono text-[11px] text-chalk-faint">{item.sku}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'mt-0.5 shrink-0 h-8 px-3 border font-display text-[10.5px] uppercase tracking-widest transition',
            open
              ? 'border-chalk text-chalk'
              : 'border-line-bright text-chalk-dim hover:border-chalk hover:text-chalk',
          )}
        >
          {open ? 'Cancelar' : 'Cambiar'}
        </button>
      </div>
      {open ? (
        <div className="bg-ink-800/30 px-5 pb-4 pt-1">
          {state ? (
            <p
              role="status"
              className={cn(
                'mb-3 border px-3 py-2 text-[12.5px]',
                state.ok
                  ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                  : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
              )}
            >
              {state.message}
            </p>
          ) : null}
          <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="itemId" value={item.id} />
            <div className="flex-1 min-w-0">
              <label className="mb-1.5 block font-display text-[10px] uppercase tracking-widest text-chalk-faint">
                Nueva variante
              </label>
              <select
                name="variantId"
                required
                defaultValue=""
                className="h-9 w-full border border-line bg-ink-900 px-2 text-[13px] text-chalk focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="" disabled>Seleccionar…</option>
                {productVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.colorName}{v.colorCode ? ` (${v.colorCode})` : ''} · T.{v.size}
                    {v.stock > 0 ? ` — ${v.stock} u.` : ' — sin stock'}
                  </option>
                ))}
              </select>
            </div>
            <Submit label="Aplicar" />
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function OrderItemsForm({
  orderId,
  items,
  availableVariants,
}: {
  orderId: string;
  items: OrderItemRow[];
  availableVariants: AvailableVariant[];
}) {
  const editableItems = items.filter(
    (item) => item.productId && availableVariants.some((v) => v.productId === item.productId),
  );

  if (editableItems.length === 0) return null;

  return (
    <Card title="Cambiar productos" description="Reemplaza la variante de cualquier ítem del pedido.">
      <div className="-mx-5 -mt-4">
        {editableItems.map((item) => (
          <ItemEditRow key={item.id} orderId={orderId} item={item} variants={availableVariants} />
        ))}
      </div>
    </Card>
  );
}

export function RefundForm({
  orderId,
  total,
  canRefund,
}: {
  orderId: string;
  total: number;
  canRefund: boolean;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(refundOrder, null);

  if (!canRefund) return null;

  return (
    <Card title="Reembolso" description="Se procesa directamente en Mercado Pago.">
      <Status state={state} />
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm('¿Confirmas el reembolso? Esta operación no se puede deshacer.')) {
            e.preventDefault();
          }
        }}
        className="space-y-3"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <Input
          label="Monto a reembolsar"
          hint="opcional"
          name="amount"
          placeholder={String(total)}
          help={`Déjalo vacío para reembolsar el total (${formatCLP(total)}). Un reembolso total devuelve el stock.`}
        />
        <Submit label="Procesar reembolso" variant="danger" />
      </form>
    </Card>
  );
}
