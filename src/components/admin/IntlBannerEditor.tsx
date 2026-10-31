'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { copyClBanners, deleteIntlBanner, moveIntlBanner, saveIntlBanner } from '@/actions/admin/intl-banner';
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
          {data.imageUrl || data.imageMobileUrl || data.videoUrl || data.videoMobileUrl ? (
            <Hero data={data} device={device} />
          ) : (
            <div className="flex h-[70%] items-center justify-center bg-[#f5f5f3] text-[15px] text-[#55585e]">
              Sube una imagen o un video para ver el banner
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface BannerRow extends HeroData {
  id: string;
  active: boolean;
}

const EMPTY: Omit<BannerRow, 'id'> = {
  imageUrl: '',
  imageMobileUrl: '',
  videoUrl: '',
  videoMobileUrl: '',
  title: '',
  body: '',
  ctaLabel: '',
  ctaHref: '',
  tone: 'DARK',
  titleSize: 'M',
  focalX: 50,
  focalY: 50,
  active: true,
};

function Status({ state }: { state: AdminState | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'mb-5 border px-3.5 py-2.5 text-[13.5px]',
        state.ok ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
      )}
    >
      {state.message}
    </p>
  );
}

/**
 * Editor de los banners de taupoc.lat, al estilo de un editor de tienda: una
 * pestaña por diapositiva, el formulario de la elegida y su vista previa en
 * escritorio y teléfono.
 */
export function IntlBannerEditor({ banners }: { banners: BannerRow[] }) {
  const [selected, setSelected] = useState<string>(banners[0]?.id ?? 'new');
  const [notice, setNotice] = useState<AdminState | null>(null);
  const [pending, start] = useTransition();
  const known = useRef(banners.map((b) => b.id));

  // Al crear o copiar, el servidor devuelve banners nuevos: se elige el recién llegado.
  useEffect(() => {
    const fresh = banners.find((b) => !known.current.includes(b.id));
    known.current = banners.map((b) => b.id);
    if (fresh) setSelected(fresh.id);
    else if (selected !== 'new' && !banners.some((b) => b.id === selected)) setSelected(banners[0]?.id ?? 'new');
  }, [banners, selected]);

  const current = banners.find((b) => b.id === selected) ?? null;
  const run = (fn: () => Promise<AdminState>) => start(async () => setNotice(await fn()));

  return (
    <div className="space-y-5">
      <Status state={notice} />
      <div className="flex flex-wrap items-center gap-2">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b.id)}
            className={cn(
              'h-10 border px-4 text-[13px]',
              selected === b.id ? 'border-[var(--accent)] text-chalk' : 'border-line text-chalk-faint hover:text-chalk',
            )}
          >
            Banner {i + 1}
            {b.videoUrl || b.videoMobileUrl ? ' · video' : ''}
            {b.active ? '' : ' · oculto'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected('new')}
          className={cn(
            'h-10 border border-dashed px-4 text-[13px]',
            selected === 'new' ? 'border-[var(--accent)] text-chalk' : 'border-line text-chalk-faint hover:text-chalk',
          )}
        >
          + Agregar banner
        </button>
        <span className="flex-1" />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm('¿Reemplazar los banners de taupoc.lat por los de la portada de taupoc.cl?')) run(copyClBanners);
          }}
          className="h-10 border border-line px-4 text-[13px] text-chalk hover:border-chalk disabled:opacity-50"
        >
          {pending ? 'Trabajando…' : 'Copiar los banners de taupoc.cl'}
        </button>
      </div>

      {current ? (
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          <button type="button" disabled={pending} onClick={() => run(() => moveIntlBanner(current.id, -1))} className="border border-line px-3 py-1.5 text-chalk-dim hover:text-chalk">
            ← Mover antes
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => moveIntlBanner(current.id, 1))} className="border border-line px-3 py-1.5 text-chalk-dim hover:text-chalk">
            Mover después →
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm('¿Eliminar este banner?')) run(() => deleteIntlBanner(current.id));
            }}
            className="border border-line px-3 py-1.5 text-signal-bad hover:border-signal-bad"
          >
            Eliminar
          </button>
        </div>
      ) : null}

      <SlideForm key={current?.id ?? 'new'} initial={current} />
    </div>
  );
}

function SlideForm({ initial }: { initial: BannerRow | null }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveIntlBanner, null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const base = initial ?? { ...EMPTY, id: '' };
  const [form, setForm] = useState({
    imageUrl: base.imageUrl ?? '',
    imageMobileUrl: base.imageMobileUrl ?? '',
    videoUrl: base.videoUrl ?? '',
    videoMobileUrl: base.videoMobileUrl ?? '',
    title: base.title ?? '',
    body: base.body ?? '',
    ctaLabel: base.ctaLabel ?? '',
    ctaHref: base.ctaHref ?? '',
    tone: base.tone ?? ('DARK' as 'DARK' | 'LIGHT'),
    titleSize: base.titleSize ?? 'M',
    focalX: String(base.focalX ?? 50),
    focalY: String(base.focalY ?? 50),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card title={initial ? 'Editar banner' : 'Nuevo banner'} description="Imagen o video, con texto y botón opcionales.">
        <Status state={state} />
        <div className="space-y-4">
          <MediaField name="imageUrl" label="Imagen de escritorio" hint="horizontal, 2400 × 1350 o más" value={form.imageUrl} onChange={set('imageUrl')} />
          <MediaField
            name="imageMobileUrl"
            label="Imagen de teléfono"
            hint="recomendada, vertical 1080 × 1600"
            value={form.imageMobileUrl}
            onChange={set('imageMobileUrl')}
          />
          <MediaField
            name="videoUrl"
            kind="video"
            label="Video de escritorio"
            hint="opcional, MP4 sin sonido"
            value={form.videoUrl}
            onChange={set('videoUrl')}
          />
          <MediaField
            name="videoMobileUrl"
            kind="video"
            label="Video de teléfono"
            hint="opcional, vertical"
            value={form.videoMobileUrl}
            onChange={(v) => {
              set('videoMobileUrl')(v);
              setDevice('mobile');
            }}
          />
          <p className="text-[12.5px] text-chalk-faint">
            Con video, la imagen se muestra mientras carga y a quien tiene activado reducir el movimiento.
          </p>
          <div className="space-y-3 border border-line p-3">
            <p className="text-[12.5px] text-chalk-faint">
              Qué parte de la foto o el video se mantiene al recortarlo (sobre todo en teléfono). Míralo en la vista previa.
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
