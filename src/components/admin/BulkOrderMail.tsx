'use client';

import { createContext, useContext, useActionState, useState, useRef, type ReactNode } from 'react';
import { sendBulkOrderEmail } from '@/actions/admin/orders';
import type { AdminState } from '@/actions/admin/products';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

const Selection = createContext<{ selected: Set<string>; toggle: (id: string) => void }>({ selected: new Set(), toggle: () => {} });

export function BulkOrderCheckbox({ id, number }: { id: string; number: string }) {
  const { selected, toggle } = useContext(Selection);
  return <input type="checkbox" name="orderIds" value={id} aria-label={`Enviar aviso de ${number}`} checked={selected.has(id)} onChange={() => toggle(id)} />;
}

export function BulkOrderMail({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('text');
  const [preview, setPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState(async (prev: AdminState | null, data: FormData) => {
    const result = await sendBulkOrderEmail(prev, data);
    if (result.ok) setSelected(new Set());
    return result;
  }, null);
  return (
    <Selection.Provider value={{ selected, toggle: (id) => setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }) }}>
    <div ref={list}>
      {children}
      <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-3 border border-line bg-ink-900 px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => {
            const boxes = list.current?.querySelectorAll<HTMLInputElement>('input[name="orderIds"]');
            if (!boxes) return;
            const select = Array.from(boxes).some((box) => !selected.has(box.value));
            setSelected(select ? new Set(Array.from(boxes, (box) => box.value)) : new Set());
          }}>Seleccionar / quitar todos</Button>
          <span aria-live="polite" className="text-sm text-chalk-faint">{selected.size} pedidos seleccionados</span>
        </div>
        <Button type="button" size="sm" disabled={pending || selected.size === 0} onClick={() => dialog.current?.showModal()}>Redactar correo</Button>
      </div>
    </div>
    <dialog ref={dialog} aria-labelledby="order-mail-title" onCancel={(event) => { if (pending) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto border border-line bg-ink-900 p-5 text-chalk shadow-2xl backdrop:bg-black/75 sm:p-6">
      <form action={action} onReset={(event) => event.preventDefault()}
        onSubmit={(event) => {
          if (!window.confirm(`¿Enviar «${subject}» a los destinatarios de ${selected.size} pedidos?`)) event.preventDefault();
        }}>
        {Array.from(selected, (id) => <input key={id} type="hidden" name="orderIds" value={id} />)}
        <fieldset disabled={pending} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="order-mail-title" className="font-display text-xl text-chalk">Redactar correo</h2>
              <p className="mt-1 text-sm text-chalk-faint">Para los destinatarios de {selected.size} pedidos seleccionados.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => dialog.current?.close()}>Cerrar</Button>
          </div>
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
          <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
            {pending ? 'Enviando…' : `Enviar correo (${selected.size})`}
          </Button>
          <p className="text-xs text-chalk-faint">El resultado confirma la aceptación del proveedor; no garantiza la entrega en la bandeja del cliente.</p>
          {state ? <p role="status" className="text-sm text-chalk">{state.message}</p> : null}
        </fieldset>
      </form>
    </dialog>
    </Selection.Provider>
  );
}
