'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { deleteQuote, updateQuote } from '@/actions/admin/quotes';
import type { AdminState } from '@/actions/admin/products';
import { regionName } from '@/lib/chile';
import { formatDateTime, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select, Textarea } from '@/components/ui/Field';
import { IconTrash } from '@/components/ui/Icons';

export interface QuoteData {
  id: string;
  clubName: string;
  contactName: string;
  email: string;
  phone: string;
  region: string | null;
  athletes: number | null;
  interest: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactada',
  QUOTED: 'Cotizada',
  WON: 'Ganada',
  LOST: 'Perdida',
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = {
  NEW: 'warn',
  CONTACTED: 'info',
  QUOTED: 'info',
  WON: 'ok',
  LOST: 'bad',
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 border border-line-bright px-4 font-display text-[10.5px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar'}
    </button>
  );
}

export function QuoteCard({ quote }: { quote: QuoteData }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateQuote, null);
  const [open, setOpen] = useState(quote.status === 'NEW');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <article className={cn('border border-line bg-ink-900', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
        <div className="min-w-[180px] flex-1">
          <p className="flex items-center gap-2 text-[15px] text-chalk">
            {quote.clubName}
            <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
          </p>
          <p className="mt-0.5 text-[12.5px] text-chalk-faint">
            {quote.contactName}
            {quote.interest ? ` · ${quote.interest}` : ''} · {formatDateTime(quote.createdAt)}
          </p>
        </div>

        <div className="min-w-[150px]">
          <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Contacto</p>
          <a href={`mailto:${quote.email}`} className="mt-1 block text-[13px] text-chalk-dim hover:accent-text">
            {quote.email}
          </a>
          <a href={`tel:${quote.phone.replace(/\s/g, '')}`} className="block text-[13px] text-chalk-dim hover:accent-text">
            {quote.phone}
          </a>
        </div>

        <div className="min-w-[110px]">
          <p className="font-display text-[9.5px] uppercase tracking-mega text-chalk-faint">Volumen</p>
          <p className="mt-1 text-[14px] text-chalk">
            {quote.athletes ? `${quote.athletes} nadadores` : '—'}
          </p>
          <p className="text-[11.5px] text-chalk-faint">{regionName(quote.region)}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="font-display text-[10.5px] uppercase tracking-widest text-chalk-dim hover:accent-text"
          >
            {open ? 'Cerrar' : 'Ver detalle'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Eliminar la cotización de ${quote.clubName}?`)) {
                startTransition(async () => {
                  await deleteQuote(quote.id);
                  router.refresh();
                });
              }
            }}
            aria-label={`Eliminar cotización de ${quote.clubName}`}
            className="text-chalk-faint hover:text-signal-bad"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line px-5 py-4">
          {quote.message ? (
            <blockquote className="mb-4 border-l-2 accent-border bg-ink-800 px-4 py-3 text-[13.5px] leading-relaxed text-chalk-dim">
              {quote.message}
            </blockquote>
          ) : (
            <p className="mb-4 text-[13px] text-chalk-faint">Sin mensaje adicional.</p>
          )}

          {state ? (
            <p
              role="status"
              className={cn(
                'mb-3 border px-3.5 py-2 text-[13px]',
                state.ok
                  ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
                  : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
              )}
            >
              {state.message}
            </p>
          ) : null}

          <form action={action} className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
            <input type="hidden" name="id" value={quote.id} />
            <Select label="Estado" name="status" defaultValue={quote.status}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Textarea
              label="Nota interna"
              name="adminNote"
              rows={2}
              defaultValue={quote.adminNote ?? ''}
              placeholder="Cotización enviada el 12/10 por $2.400.000 · esperando respuesta del directorio."
            />
            <div className="sm:col-span-2">
              <Submit />
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}
