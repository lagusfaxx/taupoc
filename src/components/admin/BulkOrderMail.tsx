'use client';

import { createContext, useContext, useActionState, useState, type ReactNode } from 'react';
import { bulkDeleteOrders, sendBulkOrderEmail } from '@/actions/admin/orders';
import type { AdminState } from '@/actions/admin/products';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

const Selection = createContext<{ selected: Set<string>; toggle: (id: string) => void }>({ selected: new Set(), toggle: () => {} });

export function BulkOrderCheckbox({ id, number }: { id: string; number: string }) {
  const { selected, toggle } = useContext(Selection);
  return <input type="checkbox" name="orderIds" value={id} aria-label={`Seleccionar ${number}`} checked={selected.has(id)} onChange={() => toggle(id)} />;
}

export function BulkOrderMail({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('text');
  const [preview, setPreview] = useState(false);
  const [state, action, pending] = useActionState(async (prev: AdminState | null, data: FormData) => {
    const result = await sendBulkOrderEmail(prev, data);
    setSelected(new Set());
    return result;
  }, null);
  const [deleteState, deleteAction, deleting] = useActionState(async (prev: AdminState | null, data: FormData) => {
    const result = await bulkDeleteOrders(prev, data);
    if (result.ok) setSelected(new Set());
    return result;
  }, null);
  const busy = pending || deleting;
  return (
    <Selection.Provider value={{ selected, toggle: (id) => setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }) }}>
    <form action={action} onReset={(event) => event.preventDefault()}
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const message = submitter?.dataset.bulkDelete === 'true'
          ? `¿Eliminar ${selected.size} ${selected.size === 1 ? 'pedido' : 'pedidos'} para siempre? Si descontaron stock, vuelve al inventario. No reembolsa pagos.`
          : `¿Enviar «${subject}» a los destinatarios de ${selected.size} pedidos?`;
        if (!window.confirm(message)) event.preventDefault();
      }}>
      <fieldset disabled={busy}>
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-signal-bad/30 p-4">
          <p className="min-w-0 flex-1 text-sm text-chalk-faint">
            ¿Pedidos de prueba? Márcalos en la tabla y elimínalos. No se puede deshacer.
          </p>
          <button
            type="submit"
            data-bulk-delete="true"
            formAction={deleteAction}
            formNoValidate
            disabled={busy || selected.size === 0}
            className="h-9 border border-signal-bad/50 bg-signal-bad/10 px-4 font-display text-[10.5px] font-bold uppercase tracking-widest text-signal-bad transition hover:bg-signal-bad/20 disabled:opacity-40"
          >
            {deleting ? 'Eliminando…' : `Eliminar seleccionados (${selected.size})`}
          </button>
          {deleteState ? (
            <p role="status" className={`w-full text-sm ${deleteState.ok ? 'text-signal-ok' : 'text-signal-bad'}`}>{deleteState.message}</p>
          ) : null}
        </div>
        <div className="mb-4 space-y-3 border border-line p-4">
          <h2 className="font-display text-lg text-chalk">Correo personalizado a pedidos</h2>
          <p className="text-sm text-chalk-faint">Selecciona hasta 25 pedidos y escribe tu correo. Se enviará un mensaje individual al correo de cada pedido, cualquiera sea su estado.</p>
          <Input label="Asunto" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} />
          <Select label="Formato del mensaje" name="format" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="text">Texto</option>
            <option value="html">HTML</option>
          </Select>
          <Textarea label={format === 'html' ? 'Código HTML del correo' : 'Mensaje'} name="content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={100000} rows={10} />
          <Button type="button" variant="outline" size="sm" onClick={() => setPreview(!preview)}>{preview ? 'Ocultar vista previa' : 'Vista previa'}</Button>
          {preview ? <section aria-label="Vista previa del correo" className="border border-line p-3">
            <p className="mb-3 font-semibold text-chalk">{subject}</p>
            {format === 'html' ? <iframe title="Vista previa HTML" srcDoc={content} sandbox="" referrerPolicy="no-referrer" className="h-80 w-full bg-white" /> : <pre className="whitespace-pre-wrap font-sans text-chalk">{content}</pre>}
          </section> : null}
          <Button type="button" variant="outline" size="sm" className="mr-3" onClick={(event) => {
            const boxes = event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="orderIds"]:not(:disabled)');
            if (!boxes) return;
            const select = Array.from(boxes).some((box) => !selected.has(box.value));
            setSelected(select ? new Set(Array.from(boxes, (box) => box.value)) : new Set());
          }}>Seleccionar / quitar todos</Button>
          <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
            {pending ? 'Enviando…' : `Enviar correo (${selected.size})`}
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
