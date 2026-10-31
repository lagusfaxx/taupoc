'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveIntlBanner } from '@/actions/admin/intl-banner';
import type { AdminState } from '@/actions/admin/products';
import { Hero, type HeroData } from '@/components/intl/Hero';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { MediaField } from './MediaField';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-8 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : 'Guardar banner'}
    </button>
  );
}

const DESKTOP_W = 1440;
const DESKTOP_H = 900;

/** Marco de vista previa: teléfono a tamaño real; escritorio escalado al ancho disponible. */
function Preview({ data, device }: { data: HeroData; device: 'desktop' | 'mobile' }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / DESKTOP_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = device === 'mobile' ? 390 : DESKTOP_W;
  const height = device === 'mobile' ? 844 : DESKTOP_H;
  const s = device === 'mobile' ? Math.min(1, 560 / height) : scale;
  return (
    <div ref={box} className="w-full">
      <div className="mx-auto overflow-hidden border border-line bg-white" style={{ width: width * s, height: height * s }}>
        <div
          style={{ width, height, transform: `scale(${s})`, transformOrigin: 'top left', ['--hero-vh' as string]: `${height / 100}px` }}
        >
          {/* Encabezado de la tienda, para ver el banner en contexto. */}
          <div className="flex h-16 items-center bg-white px-4 font-[Inter_Tight,Inter,sans-serif] text-[19px] font-semibold tracking-[0.18em] text-[#111214]">
            TAUPOC
          </div>
          {data.imageUrl ? (
            <Hero data={data} device={device} />
          ) : (
            <div className="flex h-[70%] items-center justify-center bg-[#f5f5f3] text-[15px] text-[#55585e]">
              Sube una imagen para ver el banner
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function IntlBannerEditor({ initial }: { initial: (HeroData & { active: boolean }) | null }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveIntlBanner, null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [form, setForm] = useState({
    imageUrl: initial?.imageUrl ?? '',
    imageMobileUrl: initial?.imageMobileUrl ?? '',
    title: initial?.title ?? '',
    body: initial?.body ?? '',
    ctaLabel: initial?.ctaLabel ?? '',
    ctaHref: initial?.ctaHref ?? '',
    tone: initial?.tone ?? ('DARK' as 'DARK' | 'LIGHT'),
    titleSize: initial?.titleSize ?? 'M',
    focalX: String(initial?.focalX ?? 50),
    focalY: String(initial?.focalY ?? 50),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Card title="Banner de inicio" description="Se muestra arriba de todo en la portada de taupoc.lat.">
        {state ? (
          <p
            role="status"
            className={cn(
              'mb-5 border px-3.5 py-2.5 text-[13.5px]',
              state.ok ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
            )}
          >
            {state.message}
          </p>
        ) : null}
        <div className="space-y-4">
          <MediaField name="imageUrl" label="Imagen de escritorio" hint="horizontal, 2400 × 1350 o más" value={form.imageUrl} onChange={set('imageUrl')} />
          <MediaField
            name="imageMobileUrl"
            label="Imagen de teléfono"
            hint="recomendada, vertical 1080 × 1600"
            value={form.imageMobileUrl}
            onChange={set('imageMobileUrl')}
          />
          <div className="space-y-3 border border-line p-3">
            <p className="text-[12.5px] text-chalk-faint">
              Qué parte de la foto se mantiene al recortarla (sobre todo en teléfono). Míralo en la vista previa.
            </p>
            {(
              [
                ['focalX', 'Horizontal', 'izquierda', 'derecha'],
                ['focalY', 'Vertical', 'arriba', 'abajo'],
              ] as const
            ).map(([key, label, from, to]) => (
              <label key={key} className="block text-[13px] text-chalk-dim">
                <span className="flex justify-between">
                  <span>{label}</span>
                  <span className="text-chalk-faint">
                    {from} · {form[key]} % · {to}
                  </span>
                </span>
                <input
                  type="range"
                  name={key}
                  min={0}
                  max={100}
                  value={form[key]}
                  onChange={(e) => {
                    set(key)(e.target.value);
                    setDevice('mobile');
                  }}
                  className="mt-1 w-full accent-[var(--accent)]"
                />
              </label>
            ))}
          </div>
          <Input label="Título" name="title" value={form.title} onChange={(e) => set('title')(e.target.value)} />
          <Select label="Tamaño del título" name="titleSize" value={form.titleSize} onChange={(e) => set('titleSize')(e.target.value)}>
            <option value="S">Pequeño</option>
            <option value="M">Mediano</option>
            <option value="L">Grande</option>
          </Select>
          <Textarea label="Texto" hint="opcional" name="body" rows={2} value={form.body} onChange={(e) => set('body')(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Botón" hint="opcional" name="ctaLabel" placeholder="Ver catálogo" value={form.ctaLabel} onChange={(e) => set('ctaLabel')(e.target.value)} />
            <Input label="Enlace" name="ctaHref" placeholder="/catalogo" value={form.ctaHref} onChange={(e) => set('ctaHref')(e.target.value)} />
          </div>
          <Select label="Color del texto en escritorio" name="tone" value={form.tone} onChange={(e) => set('tone')(e.target.value)}>
            <option value="DARK">Oscuro (para fotos claras)</option>
            <option value="LIGHT">Blanco (para fotos oscuras)</option>
          </Select>
          <Checkbox name="active" defaultChecked={initial?.active ?? true} label="Mostrar en la tienda" />
          <Submit />
        </div>
      </Card>

      <Card
        title="Vista previa"
        actions={
          <div className="flex border border-line">
            {(['desktop', 'mobile'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={cn('px-3 py-1.5 text-[12px]', device === d ? 'bg-ink-700 text-chalk' : 'text-chalk-faint hover:text-chalk')}
              >
                {d === 'desktop' ? 'Escritorio' : 'Teléfono'}
              </button>
            ))}
          </div>
        }
      >
        <Preview data={{ ...form, focalX: Number(form.focalX), focalY: Number(form.focalY) }} device={device} />
      </Card>
    </form>
  );
}
