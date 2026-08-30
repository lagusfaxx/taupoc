'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  refundOrder, saveOrderNote, saveTracking, updateOrderStatus,
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
