'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  decideTransfer, refundOrder, saveOrderNote, saveTracking, updateOrderStatus, updateOrderItem,
  deleteOrderAction, saveReturnAction, deleteReturnAction, returnFeeAction, sendReviewRequestAction,
} from '@/actions/admin/orders';
import type { AdminState } from '@/actions/admin/products';
import {
  ORDER_STATUS_LABEL, RETURN_FEE_STATUS_LABEL, RETURN_KIND_LABEL, RETURN_STATUS_LABEL,
} from '@/lib/order-labels';
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

/** Correo que pide calificar los productos: automático o a mano desde acá. */
export function ReviewRequestForm({
  orderId,
  canSend,
  sentAt,
  reviewUrl,
  reviewsCount,
}: {
  orderId: string;
  canSend: boolean;
  sentAt: string | null;
  reviewUrl: string | null;
  reviewsCount: number;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(sendReviewRequestAction, null);

  return (
    <Card
      title="Pedir calificación"
      description="Correo con un enlace para que el cliente califique lo que compró. Se activa en Configuración → Correos."
    >
      <Status state={state} />
      <dl className="mb-4 space-y-1.5 text-[13px]">
        <div className="flex gap-2">
          <dt className="text-chalk-faint">Enviado:</dt>
          <dd className="text-chalk-dim">{sentAt ?? 'Todavía no'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-chalk-faint">Opiniones recibidas:</dt>
          <dd className="text-chalk-dim">{reviewsCount}</dd>
        </div>
        {reviewUrl ? (
          <div className="flex min-w-0 gap-2">
            <dt className="shrink-0 text-chalk-faint">Enlace:</dt>
            <dd className="min-w-0 truncate">
              <a href={reviewUrl} target="_blank" rel="noreferrer" className="accent-text underline underline-offset-4">
                {reviewUrl}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {canSend ? (
        <form action={action}>
          <input type="hidden" name="orderId" value={orderId} />
          <Submit label={sentAt ? 'Reenviar correo' : 'Enviar ahora'} variant="outline" />
        </form>
      ) : (
        <p className="text-[13px] text-chalk-faint">Disponible cuando el pedido está despachado o entregado.</p>
      )}
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
    <Card title="Cambiar talla o producto" description="Reemplaza la variante de un ítem. Si el pedido ya descontó stock, la talla anterior vuelve al inventario y se descuenta la nueva.">
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

export type ReturnRow = {
  kind: string;
  status: string;
  reason: string | null;
  feeAmount: number;
  feeStatus: string;
  feeLabel: string | null;
  payUrl: string | null;
  feePaidAt: string | null;
  feePaymentId: string | null;
};

/**
 * Devolución o cambio de talla. Registra en qué va la prenda que vuelve y,
 * si hace falta, crea el cobro del envío que el cliente paga con Mercado Pago
 * desde el estado de su pedido.
 */
export function ReturnForm({ orderId, ret }: { orderId: string; ret: ReturnRow | null }) {
  const [open, setOpen] = useState(Boolean(ret));
  const [state, action] = useActionState<AdminState | null, FormData>(saveReturnAction, null);
  const [delState, delAction] = useActionState<AdminState | null, FormData>(deleteReturnAction, null);

  if (!open) {
    return (
      <Card title="Devolución" description="¿El cliente devolvió la prenda o pidió cambio de talla?">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 border border-line-bright px-5 font-display text-[11px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk"
        >
          Registrar devolución
        </button>
      </Card>
    );
  }

  return (
    <Card
      title="Devolución"
      description="El cliente ve el estado de la devolución en el seguimiento de su pedido."
    >
      <Status state={state ?? delState} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Select key={`k-${ret?.kind}`} label="Tipo" name="kind" defaultValue={ret?.kind ?? 'EXCHANGE'}>
          {Object.entries(RETURN_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select key={`s-${ret?.status}`} label="Estado" name="status" defaultValue={ret?.status ?? 'REQUESTED'}>
          {Object.entries(RETURN_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Textarea
          key={`r-${ret?.reason ?? ''}`}
          label="Motivo"
          hint="lo ve el cliente"
          name="reason"
          rows={3}
          maxLength={500}
          defaultValue={ret?.reason ?? ''}
          placeholder="Ej.: talla 28 le quedó chica, se cambia por talla 30."
        />
        <p className="text-[12px] leading-relaxed text-chalk-faint">
          Para un cambio de talla usa «Cambiar talla o producto» (abajo): devuelve la talla anterior al inventario y descuenta la nueva.
          Para un reembolso usa «Reembolso» o el estado «Reembolsado».
        </p>
        <div className="flex flex-wrap gap-2">
          <Submit label={ret ? 'Guardar devolución' : 'Registrar devolución'} />
          {ret ? null : (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-4 font-display text-[11px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {ret && ret.feeStatus !== 'PAID' ? (
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!confirm('¿Eliminar la devolución de este pedido?')) e.preventDefault();
          }}
          className="mt-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <button type="submit" className="text-[12px] text-signal-bad underline underline-offset-4">
            Eliminar devolución
          </button>
        </form>
      ) : null}

      {ret ? <ReturnFeeForm orderId={orderId} ret={ret} /> : null}
    </Card>
  );
}

function ReturnFeeForm({ orderId, ret }: { orderId: string; ret: ReturnRow }) {
  const [state, action] = useActionState<AdminState | null, FormData>(returnFeeAction, null);
  const [copied, setCopied] = useState(false);
  const paid = ret.feeStatus === 'PAID';
  const active = ret.feeStatus === 'PENDING';

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="font-display text-[10.5px] uppercase tracking-widest text-chalk">Cobro del envío</p>
      <p className="mt-1 text-[12.5px] text-chalk-faint">
        {RETURN_FEE_STATUS_LABEL[ret.feeStatus]}
        {ret.feeStatus !== 'NONE' && ret.feeAmount > 0 ? ` · ${formatCLP(ret.feeAmount)}` : ''}
        {paid && ret.feePaymentId ? ` · pago MP ${ret.feePaymentId}` : ''}
      </p>
      {paid ? (
        <p className="mt-2 border border-signal-ok/40 bg-signal-ok/10 px-3 py-2 text-[13px] text-signal-ok">
          El cliente pagó el envío{ret.feePaidAt ? ` el ${ret.feePaidAt}` : ''}.
        </p>
      ) : (
        <>
          {active && ret.payUrl ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={ret.payUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 border border-line bg-ink-900 px-2 font-mono text-[11.5px] text-chalk-dim"
                aria-label="Enlace de pago"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(ret.payUrl!).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="h-9 shrink-0 border border-line-bright px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
              >
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          ) : null}
          <div className="mt-3">
            <Status state={state} />
          </div>
          <form
            action={action}
            onSubmit={(e) => {
              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              if (submitter?.value === 'remove' && !confirm('¿Quitar el cobro? El enlace de pago deja de funcionar.')) {
                e.preventDefault();
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="orderId" value={orderId} />
            <Input
              key={`a-${ret.feeAmount}`}
              label="Monto a cobrar (CLP)"
              name="amount"
              inputMode="numeric"
              defaultValue={ret.feeAmount > 0 ? String(ret.feeAmount) : ''}
              placeholder="4990"
            />
            <Input
              key={`l-${ret.feeLabel ?? ''}`}
              label="Concepto"
              hint="opcional"
              name="label"
              maxLength={120}
              defaultValue={ret.feeLabel ?? ''}
              placeholder="Costo de envío de la devolución"
            />
            <Checkbox name="notify" defaultChecked label="Enviar al cliente el enlace de pago por correo" />
            <p className="text-[12px] leading-relaxed text-chalk-faint">
              El cliente paga con Mercado Pago desde el estado de su pedido o desde el enlace. Solo aparece si creas el cobro.
            </p>
            <div className="flex flex-wrap gap-2">
              <FeeButton value="set" label={active ? 'Actualizar cobro' : 'Crear cobro'} variant="accent" />
              {ret.feeStatus === 'PENDING' ? <FeeButton value="waive" label="Sin cargo" variant="outline" /> : null}
              {ret.feeStatus !== 'NONE' ? <FeeButton value="remove" label="Quitar cobro" variant="danger" /> : null}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function FeeButton({ value, label, variant }: { value: string; label: string; variant: 'accent' | 'outline' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={value}
      disabled={pending}
      className={cn(
        'h-10 px-4 font-display text-[11px] font-bold uppercase tracking-widest transition disabled:opacity-50',
        variant === 'accent'
          ? 'accent-bg hover:brightness-110'
          : variant === 'danger'
            ? 'border border-signal-bad/50 bg-signal-bad/10 text-signal-bad hover:bg-signal-bad/20'
            : 'border border-line-bright text-chalk hover:border-chalk',
      )}
    >
      {pending ? 'Procesando…' : label}
    </button>
  );
}

/** Borrado definitivo del pedido. Pide escribir el número para no borrar por error. */
export function DeleteOrderForm({
  orderId,
  number,
  hasPayment,
}: {
  orderId: string;
  number: string;
  hasPayment: boolean;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(deleteOrderAction, null);
  const [typed, setTyped] = useState('');

  return (
    <Card title="Eliminar pedido" description="Para pedidos de prueba o duplicados. No se puede deshacer.">
      <Status state={state} />
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`¿Eliminar el pedido ${number} para siempre?`)) e.preventDefault();
        }}
        className="space-y-3"
      >
        <input type="hidden" name="orderId" value={orderId} />
        {hasPayment ? (
          <p className="border border-signal-warn/40 bg-signal-warn/10 px-3 py-2 text-[12.5px] text-signal-warn">
            Este pedido tiene un pago aprobado. Borrarlo no lo reembolsa: si fue un pago real, reembolsa primero.
          </p>
        ) : null}
        <p className="text-[12px] leading-relaxed text-chalk-faint">
          Se borran el pedido, su historial y su devolución. Si ya había descontado stock, las unidades vuelven al inventario.
        </p>
        <Input
          label={`Escribe ${number} para confirmar`}
          name="confirmNumber"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <DangerSubmit disabled={typed.trim().toUpperCase() !== number.toUpperCase()} />
      </form>
    </Card>
  );
}

function DangerSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-10 border border-signal-bad/50 bg-signal-bad/10 px-5 font-display text-[11px] font-bold uppercase tracking-widest text-signal-bad transition hover:bg-signal-bad/20 disabled:opacity-40"
    >
      {pending ? 'Eliminando…' : 'Eliminar pedido'}
    </button>
  );
}
