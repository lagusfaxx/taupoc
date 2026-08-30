'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteCoupon, saveCoupon, toggleCoupon } from '@/actions/admin/coupons';
import type { AdminState } from '@/actions/admin/products';
import { formatCLP, formatNumber } from '@/lib/money';
import { formatDate, cn } from '@/lib/utils';
import { Card } from './Card';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

export interface CouponData {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  productIds: string[];
}

const TYPE_LABEL: Record<string, string> = {
  PERCENT: 'Porcentaje',
  FIXED: 'Monto fijo',
  FREE_SHIPPING: 'Envío gratis',
};

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

function CouponForm({
  coupon,
  products,
  onDone,
}: {
  coupon?: CouponData;
  products: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveCoupon, null);
  const [type, setType] = useState(coupon?.type ?? 'PERCENT');
  const [restrict, setRestrict] = useState((coupon?.productIds.length ?? 0) > 0);
  const router = useRouter();
  if (state?.ok) setTimeout(() => { router.refresh(); onDone(); }, 250);

  return (
    <form action={action} className="border border-line bg-ink-800 p-5">
      {coupon ? <input type="hidden" name="id" value={coupon.id} /> : null}

      {state ? (
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
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Código"
          name="code"
          required
          defaultValue={coupon?.code}
          placeholder="CLUB10"
          help="Es lo que escribe el cliente en el carrito. Sin espacios."
          className="uppercase"
        />
        <Select label="Tipo de descuento" name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="PERCENT">Porcentaje sobre los productos</option>
          <option value="FIXED">Monto fijo en pesos</option>
          <option value="FREE_SHIPPING">Envío gratis</option>
        </Select>

        {type !== 'FREE_SHIPPING' ? (
          <Input
            label={type === 'PERCENT' ? 'Porcentaje de descuento' : 'Monto del descuento'}
            name="value"
            required
            defaultValue={coupon ? (type === 'PERCENT' ? String(coupon.value) : formatNumber(coupon.value)) : ''}
            placeholder={type === 'PERCENT' ? '10' : '15.000'}
            help={type === 'PERCENT' ? 'Entre 1 y 100.' : 'En pesos chilenos.'}
          />
        ) : null}

        <Input
          label="Compra mínima"
          hint="opcional"
          name="minSubtotal"
          defaultValue={coupon?.minSubtotal ? formatNumber(coupon.minSubtotal) : ''}
          placeholder="100.000"
        />
        <Input
          label="Usos totales máximos"
          hint="opcional"
          name="maxUses"
          type="number"
          defaultValue={coupon?.maxUses ?? ''}
          help="Déjalo vacío para usos ilimitados."
        />
        <Input
          label="Usos por cliente"
          hint="opcional"
          name="perUserLimit"
          type="number"
          defaultValue={coupon?.perUserLimit ?? ''}
          placeholder="1"
        />
        <Input label="Vigente desde" hint="opcional" name="startsAt" type="date" defaultValue={coupon?.startsAt ?? ''} />
        <Input label="Vigente hasta" hint="opcional" name="endsAt" type="date" defaultValue={coupon?.endsAt ?? ''} />
        <Textarea
          label="Descripción interna"
          hint="opcional"
          name="description"
          rows={2}
          defaultValue={coupon?.description ?? ''}
          placeholder="Campaña de clubes federados, temporada 2026"
          className="sm:col-span-2"
        />
      </div>

      <div className="mt-4 space-y-3">
        <Checkbox
          checked={restrict}
          onChange={(e) => setRestrict(e.target.checked)}
          label="Limitar el descuento a productos específicos"
        />
        {restrict ? (
          <div className="grid gap-1.5 border border-line bg-ink-900 p-4 sm:grid-cols-2">
            {products.map((product) => (
              <label key={product.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-chalk-dim">
                <input
                  type="checkbox"
                  name="productIds"
                  value={product.id}
                  defaultChecked={coupon?.productIds.includes(product.id)}
                  className="h-3.5 w-3.5 cursor-pointer appearance-none border border-line-bright bg-ink-900 checked:border-[var(--accent)] checked:bg-[var(--accent)]"
                />
                {product.name}
              </label>
            ))}
          </div>
        ) : null}
        <Checkbox name="active" defaultChecked={coupon?.active ?? true} label="Cupón activo" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Submit label={coupon ? 'Guardar cupón' : 'Crear cupón'} />
        <button type="button" onClick={onDone} className="h-10 px-3 font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function CouponManager({
  coupons,
  products,
}: {
  coupons: CouponData[];
  products: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className={cn('space-y-4', pending && 'opacity-70')}>
      {editing === 'new' ? (
        <CouponForm products={products} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-line-bright py-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:border-chalk hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Crear cupón
        </button>
      )}

      {coupons.map((coupon) =>
        editing === coupon.id ? (
          <CouponForm key={coupon.id} coupon={coupon} products={products} onDone={() => setEditing(null)} />
        ) : (
          <Card key={coupon.id} padded={false}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
              <div className="min-w-[160px]">
                <p className="flex items-center gap-2 font-mono text-[16px] font-semibold accent-text">
                  {coupon.code}
                  {!coupon.active ? <Badge tone="muted">Inactivo</Badge> : null}
                  {coupon.endsAt && new Date(coupon.endsAt) < new Date() ? (
                    <Badge tone="bad">Vencido</Badge>
                  ) : null}
                </p>
                {coupon.description ? (
                  <p className="mt-1 text-[12px] text-chalk-faint">{coupon.description}</p>
                ) : null}
              </div>

              <div className="min-w-[130px]">
                <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Descuento</p>
                <p className="mt-1 text-[14px] text-chalk">
                  {coupon.type === 'PERCENT'
                    ? `${coupon.value}%`
                    : coupon.type === 'FIXED'
                      ? formatCLP(coupon.value)
                      : 'Envío gratis'}
                </p>
                <p className="text-[11.5px] text-chalk-faint">{TYPE_LABEL[coupon.type]}</p>
              </div>

              <div className="min-w-[120px]">
                <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Usos</p>
                <p className="mt-1 text-[14px] text-chalk">
                  {coupon.usedCount}
                  {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                </p>
                {coupon.minSubtotal ? (
                  <p className="text-[11.5px] text-chalk-faint">Mín. {formatCLP(coupon.minSubtotal)}</p>
                ) : null}
              </div>

              <div className="min-w-[140px] flex-1">
                <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Vigencia</p>
                <p className="mt-1 text-[13px] text-chalk-dim">
                  {coupon.startsAt || coupon.endsAt
                    ? `${coupon.startsAt ? formatDate(coupon.startsAt) : 'Sin inicio'} → ${coupon.endsAt ? formatDate(coupon.endsAt) : 'Sin término'}`
                    : 'Sin límite de fechas'}
                </p>
                {coupon.productIds.length > 0 ? (
                  <p className="text-[11.5px] text-chalk-faint">
                    Limitado a {coupon.productIds.length} productos
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await toggleCoupon(coupon.id, !coupon.active);
                      router.refresh();
                    })
                  }
                  className="font-display text-[10.5px] uppercase tracking-widest text-chalk-faint hover:text-chalk"
                >
                  {coupon.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(coupon.id)}
                  className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar el cupón ${coupon.code}? Si ya fue usado solo se desactivará.`)) {
                      startTransition(async () => {
                        await deleteCoupon(coupon.id);
                        router.refresh();
                      });
                    }
                  }}
                  aria-label={`Eliminar cupón ${coupon.code}`}
                  className="text-chalk-faint hover:text-signal-bad"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ),
      )}

      {coupons.length === 0 ? (
        <p className="border border-line bg-ink-900 px-5 py-10 text-center text-[13.5px] text-chalk-faint">
          Todavía no hay cupones creados.
        </p>
      ) : null}
    </div>
  );
}
