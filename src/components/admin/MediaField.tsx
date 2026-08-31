'use client';

import { useRef, useState, useTransition } from 'react';
import { importMedia } from '@/actions/admin/home';
import { Label } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconClose } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

/**
 * Campo de imagen o video: se arrastra un archivo, se elige del disco o se
 * pega una dirección. El valor viaja en un input oculto, así que el formulario
 * que lo contiene lo guarda como cualquier otro campo.
 *
 * Una dirección pegada se descarga y se guarda en la tienda en lugar de dejar
 * el enlace apuntando afuera: así se optimiza igual que una subida y la
 * portada no se queda sin imagen el día que ese servidor cambie.
 */
export function MediaField({
  name,
  label,
  hint,
  kind = 'image',
  defaultValue,
  value: controlled,
  onChange,
  className,
}: {
  /** Con nombre, el valor viaja en un input oculto del formulario. */
  name?: string;
  label: string;
  hint?: string;
  kind?: 'image' | 'video';
  defaultValue?: string | null;
  /** Con `value` y `onChange` el valor lo lleva quien lo contiene. */
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const [interno, setInterno] = useState(defaultValue ?? '');
  const value = controlled ?? interno;
  const setValue = (next: string) => {
    if (onChange) onChange(next);
    else setInterno(next);
  };
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);

    const body = new FormData();
    body.set('file', file);
    body.set('kind', kind);

    try {
      const response = await fetch('/api/admin/media', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ ok: false, text: data.error ?? 'No se pudo subir el archivo.' });
      } else {
        setValue(data.url);
        setMessage(data.warning ? { ok: false, text: data.warning } : null);
      }
    } catch {
      setMessage({ ok: false, text: 'Se cortó la subida. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  function importFromUrl() {
    const url = urlRef.current?.value.trim();
    if (!url) return;
    setMessage(null);
    startTransition(async () => {
      const result = await importMedia(url, kind);
      if (result.ok && result.id) {
        setValue(result.id);
        if (urlRef.current) urlRef.current.value = '';
        setMessage(result.message === 'Archivo importado.' ? null : { ok: false, text: result.message });
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  const trabajando = busy || pending;

  return (
    <div className={className}>
      <Label hint={hint}>{label}</Label>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void upload(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'border border-dashed border-line bg-ink-900 p-3 transition-colors',
          dragOver && 'border-[var(--accent)]',
        )}
      >
        {value ? (
          <div className="flex items-start gap-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden border border-line bg-ink">
              {kind === 'video' ? (
                <video src={value} muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="" className="h-full w-full object-contain" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="break-all text-[12px] text-chalk-faint">{value}</p>
              <button
                type="button"
                onClick={() => setValue('')}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-chalk-dim hover:text-signal-bad"
              >
                <IconClose className="h-3.5 w-3.5" />
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-chalk-faint">
            Arrastra {kind === 'video' ? 'un video .mp4 o .webm' : 'una imagen'} aquí, elígela del
            disco o pega una dirección.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/*,.heic,.heif'}
            className="hidden"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={trabajando}
          >
            {busy ? 'Subiendo…' : 'Elegir archivo'}
          </Button>

          <input
            ref={urlRef}
            type="url"
            placeholder="https://…"
            className="min-w-0 flex-1 border border-line bg-ink px-3 py-2 text-[13px] text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none"
          />
          <Button type="button" size="sm" variant="outline" onClick={importFromUrl} disabled={trabajando}>
            {pending ? 'Trayendo…' : 'Traer de la URL'}
          </Button>
        </div>

        {message ? (
          <p className={cn('mt-2 text-[12.5px]', message.ok ? 'text-signal-ok' : 'text-signal-warn')}>
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
