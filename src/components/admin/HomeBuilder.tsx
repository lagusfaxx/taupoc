'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  cleanUpMedia,
  createBlock,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  seedDefaultBlocks,
  toggleBlock,
} from '@/actions/admin/home';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/admin/Card';
import { IconCopy, IconTrash } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export interface BlockRow {
  id: string;
  type: string;
  label: string;
  title: string | null;
  active: boolean;
  items: number;
}

const TIPOS: { value: string; label: string; note: string }[] = [
  { value: 'BANNER', label: 'Banner', note: 'Foto o video con título y botón.' },
  { value: 'PRODUCTOS', label: 'Productos', note: 'Franja con los productos que elijas.' },
  { value: 'CATEGORIAS', label: 'Accesos', note: 'Tarjetas con foto y enlace.' },
  { value: 'MEDIA', label: 'Imagen o video', note: 'Solo el medio, sin texto encima.' },
  { value: 'TEXTO', label: 'Texto', note: 'Un párrafo con un botón al lado.' },
];

const NOMBRES: Record<string, string> = Object.fromEntries(
  TIPOS.map((tipo) => [tipo.value, tipo.label]),
);

export function HomeBuilder({ blocks }: { blocks: BlockRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(work: () => Promise<unknown>) {
    startTransition(async () => {
      await work();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      <Card
        title="Secciones del inicio"
        description="El visitante las ve en este orden."
        padded={false}
      >
        {blocks.length === 0 ? (
          <div className="px-5 py-8">
            <p className="text-[13.5px] text-chalk-faint">
              Sin bloques, el inicio muestra el catálogo, los accesos por género y línea, y el
              bloque de clubes. Al crear el primero, esta lista pasa a mandar.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await seedDefaultBlocks();
                  setMessage(result.message);
                  router.refresh();
                })
              }
            >
              Partir desde la portada actual
            </Button>
          </div>
        ) : (
          <ul>
            {blocks.map((block, index) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={index === 0 || pending}
                    onClick={() => run(() => moveBlock(block.id, 'arriba'))}
                    className="px-1 text-chalk-faint hover:text-chalk disabled:opacity-30"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === blocks.length - 1 || pending}
                    onClick={() => run(() => moveBlock(block.id, 'abajo'))}
                    className="px-1 text-chalk-faint hover:text-chalk disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/inicio/${block.id}`}
                    className="block truncate font-display text-[14px] text-chalk hover:accent-text"
                  >
                    {block.label || block.title || NOMBRES[block.type] || block.type}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-chalk-faint">
                    {NOMBRES[block.type] ?? block.type}
                    {block.items > 0 ? ` · ${block.items} elemento${block.items === 1 ? '' : 's'}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => toggleBlock(block.id, !block.active))}
                  className={cn(
                    'border px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-widest',
                    block.active
                      ? 'border-signal-ok/40 text-signal-ok'
                      : 'border-line text-chalk-faint',
                  )}
                >
                  {block.active ? 'Visible' : 'Oculto'}
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => duplicateBlock(block.id))}
                  className="text-chalk-faint hover:text-chalk"
                  aria-label="Duplicar"
                >
                  <IconCopy className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm('¿Borrar este bloque del inicio?')) run(() => deleteBlock(block.id));
                  }}
                  className="text-chalk-faint hover:text-signal-bad"
                  aria-label="Borrar"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Agregar un bloque">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TIPOS.map((tipo) => (
            <button
              key={tipo.value}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await createBlock(tipo.value);
                  if (result.ok && result.id) router.push(`/admin/inicio/${result.id}`);
                })
              }
              className="border border-line bg-ink p-4 text-left transition-colors hover:border-line-bright disabled:opacity-50"
            >
              <span className="block font-display text-[13px] uppercase tracking-widest text-chalk">
                {tipo.label}
              </span>
              <span className="mt-1 block text-[12.5px] text-chalk-faint">{tipo.note}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Archivos"
        description="Las fotos y videos que se reemplazaron quedan guardados hasta que se limpian."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cleanUpMedia();
                setMessage(result.message);
              })
            }
          >
            Borrar archivos sin usar
          </Button>
          {message ? <p className="text-[13px] text-chalk-dim">{message}</p> : null}
        </div>
      </Card>
    </div>
  );
}
