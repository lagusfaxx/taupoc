'use client';

import { createContext, useContext, useActionState, useState, type ReactNode } from 'react';
import { sendBulkOrderUpdates } from '@/actions/admin/orders';
import type { AdminState } from '@/actions/admin/products';
import { Button } from '@/components/ui/Button';

const Selection = createContext<{ selected: Set<string>; toggle: (id: string) => void }>({ selected: new Set(), toggle: () => {} });

export function BulkOrderCheckbox({ id, number, disabled }: { id: string; number: string; disabled: boolean }) {
  const { selected, toggle } = useContext(Selection);
  return <input type="checkbox" name="orderIds" value={id} aria-label={`Enviar aviso de ${number}`} disabled={disabled} checked={selected.has(id)} onChange={() => toggle(id)} />;
}

export function BulkOrderMail({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(async (prev: AdminState | null, data: FormData) => {
    const result = await sendBulkOrderUpdates(prev, data);
    setSelected(new Set());
    return result;
  }, null);
  return (
    <Selection.Provider value={{ selected, toggle: (id) => setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }) }}>
    <form action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Enviar ${selected.size} avisos a los clientes seleccionados? Los pedidos ya notificados recibirán otro correo.`)) event.preventDefault();
      }}>
      <fieldset disabled={pending}>
        <div className="mb-4 space-y-3 border border-line p-4">
          <h2 className="font-display text-lg text-chalk">Avisos masivos de pedidos</h2>
          <p className="text-sm text-chalk-faint">Selecciona hasta 25 pedidos de esta página. Cada cliente recibirá un correo individual con el estado actual: en preparación, despachado con seguimiento o entregado. Los avisos se pueden reenviar; el estado del pedido no cambia.</p>
          <Button type="button" variant="outline" size="sm" className="mr-3" onClick={(event) => {
            const boxes = event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="orderIds"]:not(:disabled)');
            if (!boxes) return;
            const select = Array.from(boxes).some((box) => !selected.has(box.value));
            setSelected(select ? new Set(Array.from(boxes, (box) => box.value)) : new Set());
          }}>Seleccionar / quitar todos</Button>
          <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
            {pending ? 'Enviando…' : `Enviar avisos (${selected.size})`}
          </Button>
          <p className="text-xs text-chalk-faint">El resultado confirma la aceptación del proveedor; no garantiza la entrega en la bandeja del cliente.</p>
          {state ? <p role="status" className="text-sm text-chalk">{state.message}</p> : null}
        </div>
        {children}
      </fieldset>
    </form>
    </Selection.Provider>
  );
}
