'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { updateGiveaway } from '@/actions/admin/giveaway';
import type { AdminState } from '@/actions/admin/products';
import { normalizeUser, parseEntries, uniqueUsers, type Giveaway } from '@/lib/giveaway';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Checkbox, Input, Textarea } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar sorteo'}
    </button>
  );
}

export function GiveawayForm({ giveaway }: { giveaway: Giveaway }) {
  const [state, action] = useActionState<AdminState | null, FormData>(updateGiveaway, null);
  const [entriesText, setEntriesText] = useState(giveaway.entriesText);
  const [winner, setWinner] = useState(giveaway.winner);

  const entries = useMemo(() => parseEntries(entriesText), [entriesText]);
  const users = useMemo(() => uniqueUsers(entries), [entries]);
  const winnerFound = !winner.trim() || entries.some((e) => normalizeUser(e.user) === normalizeUser(winner));

  return (
    <form action={action} className="space-y-6">
      {state ? (
        <p
          role="status"
          className={cn(
            'border px-3.5 py-2.5 text-[13.5px]',
            state.ok
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
          )}
        >
          {state.message}
        </p>
      ) : null}

      <Card title="Publicación" description="La página pública queda en /sorteo.">
        <div className="space-y-4">
          <Checkbox
            name="active"
            defaultChecked={giveaway.active}
            label="Publicar el sorteo"
            help="Mientras no esté publicado, /sorteo no se muestra."
          />
          <Checkbox
            name="showBanner"
            defaultChecked={giveaway.showBanner}
            label='Mostrar el aviso "Ver ganador del sorteo" arriba de todo el sitio'
          />
          {giveaway.active ? (
            <Link href="/sorteo" target="_blank" className="inline-block text-[13.5px] accent-text underline underline-offset-4">
              Abrir /sorteo
            </Link>
          ) : null}
        </div>
      </Card>

      <Card title="Datos del sorteo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Título" name="title" defaultValue={giveaway.title} required />
          <Input label="Premio" hint="opcional" name="prize" defaultValue={giveaway.prize} placeholder="Jammer R-SKIN a elección" />
          <Textarea
            label="Texto"
            hint="opcional"
            name="description"
            rows={3}
            defaultValue={giveaway.description}
            placeholder="Gracias a todos los que participaron. El ganador se eligió al azar entre los comentarios."
            className="sm:col-span-2"
          />
        </div>
      </Card>

      <Card
        title="Participantes"
        description="Pega un comentario por línea: @usuario: comentario. También sirve solo el usuario."
      >
        <Textarea
          label="Comentarios"
          name="entriesText"
          rows={12}
          value={entriesText}
          onChange={(e) => setEntriesText(e.target.value)}
          placeholder={'@nadadora_23: ¡Quiero ganar! @amiga1 @amiga2\n@juanperez: Participo 🏊\n@club_delfines'}
          className="font-mono"
        />
        <p className="mt-2 text-[13px] text-chalk-faint">
          {entries.length} comentarios · {users.length} usuarios distintos
        </p>

        <div className="mt-5 max-w-sm">
          <Input
            label="Ganador"
            name="winner"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            placeholder="@usuario"
            list="giveaway-users"
            autoComplete="off"
            error={winnerFound ? undefined : 'Ese usuario no está en la lista.'}
            help="Debe estar en la lista. La animación termina siempre en este usuario."
          />
          <datalist id="giveaway-users">
            {users.map((u) => (
              <option key={u} value={`@${u}`} />
            ))}
          </datalist>
        </div>
      </Card>

      <Submit />
    </form>
  );
}
