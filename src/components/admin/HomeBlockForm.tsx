'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveBlock } from '@/actions/admin/home';
import { Input, Textarea, Select, Checkbox, Label } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/admin/Card';
import { MediaField } from '@/components/admin/MediaField';
import { IconClose, IconPlus } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export interface BlockFormData {
  id: string;
  type: string;
  label: string;
  active: boolean;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaAltLabel: string | null;
  ctaAltHref: string | null;
  imageUrl: string | null;
  imageMobileUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  fit: string;
  overlay: number;
  height: string;
  align: string;
  background: string;
  columns: number;
  intervalSec: number;
  productIds: string[];
  cards: SlideData[];
}

export interface SlideData {
  eyebrow: string;
  label: string;
  caption: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
  imageMobileUrl: string;
  videoUrl: string;
  posterUrl: string;
}

const SLIDE_VACIA: SlideData = {
  eyebrow: '',
  label: '',
  caption: '',
  ctaLabel: '',
  href: '',
  imageUrl: '',
  imageMobileUrl: '',
  videoUrl: '',
  posterUrl: '',
};

/**
 * Medidas recomendadas según el alto elegido.
 *
 * El banner ocupa todo el ancho de la pantalla y su alto es fijo, así que la
 * proporción visible cambia con cada pantalla: son las de un notebook de 1440
 * y un teléfono de 390, que es donde mira casi todo el mundo. En un monitor
 * más ancho la misma foto pierde algo arriba y abajo, de ahí que convenga
 * dejar al sujeto al centro.
 */
const MEDIDAS: Record<string, { escritorio: string; celular: string }> = {
  COMPACTA: { escritorio: '2400 × 500', celular: '1080 × 660' },
  MEDIA: { escritorio: '2400 × 800', celular: '1080 × 1050' },
  ALTA: { escritorio: '2400 × 1100', celular: '1080 × 1440' },
  PANTALLA: { escritorio: '2400 × 1290', celular: '1080 × 2010' },
  AUTO: { escritorio: '2400 × 800', celular: '1080 × 1050' },
};

export interface PickableProduct {
  id: string;
  name: string;
  modelCode: string;
}

const TIPO_MEDIO = ['BANNER', 'MEDIA'];

export function HomeBlockForm({
  block,
  products,
}: {
  block: BlockFormData;
  products: PickableProduct[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveBlock, null);
  const [picked, setPicked] = useState<string[]>(block.productIds);
  const esBanner = block.type === 'BANNER';

  // Un banner que todavía guarda su foto y su texto en el bloque se muestra
  // como una lámina ya llena: así se le pueden agregar más sin rehacerlo.
  const [height, setHeight] = useState(block.height);
  const medidas = MEDIDAS[height] ?? MEDIDAS.MEDIA;

  const [cards, setCards] = useState<SlideData[]>(() => {
    if (block.cards.length > 0) return block.cards;
    if (!esBanner) return [SLIDE_VACIA];
    return [
      {
        ...SLIDE_VACIA,
        eyebrow: block.eyebrow ?? '',
        label: block.title ?? '',
        caption: block.subtitle ?? '',
        ctaLabel: block.ctaLabel ?? '',
        href: block.ctaHref ?? '',
        imageUrl: block.imageUrl ?? '',
        imageMobileUrl: block.imageMobileUrl ?? '',
        videoUrl: block.videoUrl ?? '',
        posterUrl: block.posterUrl ?? '',
      },
    ];
  });

  const conMedio = block.type === 'MEDIA';
  const conProductos = block.type === 'PRODUCTOS';
  const conTarjetas = block.type === 'CATEGORIAS';

  function toggleProduct(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function moveProduct(id: string, delta: number) {
    setPicked((current) => {
      const next = [...current];
      const from = next.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= next.length) return current;
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }

  function moveCard(index: number, delta: number) {
    setCards((current) => {
      const next = [...current];
      const to = index + delta;
      if (to < 0 || to >= next.length) return current;
      next.splice(to, 0, ...next.splice(index, 1));
      return next;
    });
  }

  function updateCard(index: number, patch: Partial<(typeof cards)[number]>) {
    setCards((current) => current.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  }

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <input type="hidden" name="id" value={block.id} />

      <div className="grid gap-5">
        <Card title="Contenido">
          <div className="grid gap-4">
            <Input
              name="label"
              label="Nombre interno"
              help="Solo para reconocerlo en la lista de bloques."
              defaultValue={block.label}
            />

            {block.type !== 'MEDIA' && !esBanner ? (
              <>
                <Input name="eyebrow" label="Antetítulo" defaultValue={block.eyebrow ?? ''} />
                <Input name="title" label="Título" defaultValue={block.title ?? ''} />
                <Input name="subtitle" label="Bajada" defaultValue={block.subtitle ?? ''} />
              </>
            ) : (
              <>
                <input type="hidden" name="eyebrow" value={esBanner ? (block.eyebrow ?? '') : ''} />
                <input type="hidden" name="title" value={block.title ?? ''} />
                <input type="hidden" name="subtitle" value={esBanner ? (block.subtitle ?? '') : ''} />
              </>
            )}

            {block.type === 'TEXTO' ? (
              <Textarea name="body" label="Texto" rows={5} defaultValue={block.body ?? ''} />
            ) : (
              <input type="hidden" name="body" value={block.body ?? ''} />
            )}

            {esBanner ? (
              <>
                <input type="hidden" name="ctaLabel" value={block.ctaLabel ?? ''} />
                <input type="hidden" name="ctaHref" value={block.ctaHref ?? ''} />
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="ctaLabel" label="Botón" defaultValue={block.ctaLabel ?? ''} />
                <Input
                  name="ctaHref"
                  label="Enlace del botón"
                  placeholder="/catalogo"
                  defaultValue={block.ctaHref ?? ''}
                />
              </div>
            )}

            {conMedio ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="ctaAltLabel" label="Segundo botón" defaultValue={block.ctaAltLabel ?? ''} />
                <Input
                  name="ctaAltHref"
                  label="Enlace del segundo botón"
                  defaultValue={block.ctaAltHref ?? ''}
                />
              </div>
            ) : (
              <>
                <input type="hidden" name="ctaAltLabel" value={block.ctaAltLabel ?? ''} />
                <input type="hidden" name="ctaAltHref" value={block.ctaAltHref ?? ''} />
              </>
            )}
          </div>
        </Card>

        {conMedio ? (
          <Card
            title="Imagen o video"
            description="Con un video, la imagen queda de respaldo mientras carga."
          >
            <div className="grid gap-4">
              <MediaField name="imageUrl" label="Imagen" defaultValue={block.imageUrl} />
              <MediaField
                name="imageMobileUrl"
                label="Imagen para celular"
                hint="opcional"
                defaultValue={block.imageMobileUrl}
              />
              <MediaField
                name="videoUrl"
                label="Video"
                hint="mp4 o webm"
                kind="video"
                defaultValue={block.videoUrl}
              />
              <MediaField
                name="posterUrl"
                label="Primer cuadro del video"
                hint="opcional"
                defaultValue={block.posterUrl}
              />
            </div>
          </Card>
        ) : (
          <>
            <input type="hidden" name="imageUrl" value={block.imageUrl ?? ''} />
            <input type="hidden" name="imageMobileUrl" value={block.imageMobileUrl ?? ''} />
            <input type="hidden" name="videoUrl" value={block.videoUrl ?? ''} />
            <input type="hidden" name="posterUrl" value={block.posterUrl ?? ''} />
          </>
        )}

        {conProductos ? (
          <Card
            title="Productos"
            description="Sin ninguno marcado, la franja muestra los destacados del catálogo."
          >
            {picked.length > 0 ? (
              <ol className="mb-4 grid gap-1.5">
                {picked.map((id, index) => {
                  const product = products.find((item) => item.id === id);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 border border-line bg-ink px-3 py-2 text-[13.5px] text-chalk"
                    >
                      <input type="hidden" name="productId" value={id} />
                      <span className="w-5 text-chalk-faint">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {product ? `${product.modelCode} · ${product.name}` : id}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveProduct(id, -1)}
                        className="px-1.5 text-chalk-faint hover:text-chalk"
                        aria-label="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProduct(id, 1)}
                        className="px-1.5 text-chalk-faint hover:text-chalk"
                        aria-label="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProduct(id)}
                        className="px-1 text-chalk-faint hover:text-signal-bad"
                        aria-label="Quitar"
                      >
                        <IconClose className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            <div className="grid max-h-72 gap-1 overflow-y-auto border border-line bg-ink p-3">
              {products.map((product) => (
                <Checkbox
                  key={product.id}
                  label={`${product.modelCode} · ${product.name}`}
                  checked={picked.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                />
              ))}
            </div>
          </Card>
        ) : null}

        {conTarjetas || esBanner ? (
          <Card
            title={esBanner ? 'Láminas' : 'Tarjetas'}
            description={
              esBanner
                ? 'Con más de una, el banner las va pasando solo: las fotos por tiempo y los videos cuando terminan.'
                : 'Cada una es un acceso con su foto y su enlace.'
            }
          >
            <div className="grid gap-4">
              {cards.map((card, index) => (
                <div key={index} className="grid gap-3 border border-line bg-ink p-4">
                  <div className="flex items-center justify-between">
                    <Label>
                      {esBanner ? 'Lámina' : 'Tarjeta'} {index + 1}
                    </Label>
                    <div className="flex items-center gap-3">
                      {cards.length > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => moveCard(index, -1)}
                            className="text-chalk-faint hover:text-chalk"
                            aria-label="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCard(index, 1)}
                            className="text-chalk-faint hover:text-chalk"
                            aria-label="Bajar"
                          >
                            ↓
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCards((current) => current.filter((_, i) => i !== index))}
                        className="text-[12px] text-chalk-faint hover:text-signal-bad"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>

                  <input type="hidden" name="cardLabel" value={card.label} />
                  <input type="hidden" name="cardEyebrow" value={card.eyebrow} />
                  <input type="hidden" name="cardCaption" value={card.caption} />
                  <input type="hidden" name="cardCta" value={card.ctaLabel} />
                  <input type="hidden" name="cardHref" value={card.href} />
                  <input type="hidden" name="cardImage" value={card.imageUrl} />
                  <input type="hidden" name="cardMobile" value={card.imageMobileUrl} />
                  <input type="hidden" name="cardVideo" value={card.videoUrl} />
                  <input type="hidden" name="cardPoster" value={card.posterUrl} />

                  {esBanner ? (
                    <Input
                      label="Antetítulo"
                      value={card.eyebrow}
                      onChange={(event) => updateCard(index, { eyebrow: event.target.value })}
                    />
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Título"
                      value={card.label}
                      onChange={(event) => updateCard(index, { label: event.target.value })}
                    />
                    <Input
                      label={esBanner ? 'Enlace del botón' : 'Enlace'}
                      placeholder="/catalogo"
                      value={card.href}
                      onChange={(event) => updateCard(index, { href: event.target.value })}
                    />
                  </div>

                  <div className={cn('grid gap-3', esBanner && 'sm:grid-cols-2')}>
                    <Input
                      label={esBanner ? 'Bajada' : 'Nota'}
                      value={card.caption}
                      onChange={(event) => updateCard(index, { caption: event.target.value })}
                    />
                    {esBanner ? (
                      <Input
                        label="Botón"
                        value={card.ctaLabel}
                        onChange={(event) => updateCard(index, { ctaLabel: event.target.value })}
                      />
                    ) : null}
                  </div>

                  <MediaField
                    label={esBanner ? 'Imagen' : 'Foto'}
                    hint={esBanner ? `${medidas.escritorio} px` : undefined}
                    value={card.imageUrl}
                    onChange={(imageUrl) => updateCard(index, { imageUrl })}
                  />

                  {esBanner ? (
                    <>
                      <MediaField
                        label="Imagen para celular"
                        hint={`${medidas.celular} px · opcional`}
                        value={card.imageMobileUrl}
                        onChange={(imageMobileUrl) => updateCard(index, { imageMobileUrl })}
                      />
                      <MediaField
                        label="Video"
                        hint="mp4 o webm"
                        kind="video"
                        value={card.videoUrl}
                        onChange={(videoUrl) => updateCard(index, { videoUrl })}
                      />
                      <MediaField
                        label="Primer cuadro del video"
                        hint="opcional"
                        value={card.posterUrl}
                        onChange={(posterUrl) => updateCard(index, { posterUrl })}
                      />
                    </>
                  ) : null}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCards((current) => [...current, SLIDE_VACIA])}
              >
                <IconPlus className="h-3.5 w-3.5" />
                {esBanner ? 'Agregar lámina' : 'Agregar tarjeta'}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-5">
        <Card title="Presentación">
          <div className="grid gap-4">
            <Checkbox name="active" label="Visible en el inicio" defaultChecked={block.active} />

            {conMedio || esBanner ? (
              <>
                <Select
                  name="height"
                  label="Alto"
                  defaultValue={block.height}
                  onChange={(event) => setHeight(event.target.value)}
                  help={`Fotos de ${medidas.escritorio} px para escritorio y ${medidas.celular} px para celular. Con "Mostrar completa" en Encuadre se ve toda la foto, sin recorte.`}
                >
                  <option value="COMPACTA">Compacto</option>
                  <option value="MEDIA">Medio</option>
                  <option value="ALTA">Alto</option>
                  <option value="PANTALLA">Pantalla completa</option>
                </Select>

                <Select name="align" label="Alineación del texto" defaultValue={block.align}>
                  <option value="IZQUIERDA">Izquierda</option>
                  <option value="CENTRO">Centro</option>
                  <option value="DERECHA">Derecha</option>
                </Select>

                <Select name="fit" label="Encuadre" defaultValue={block.fit}>
                  <option value="cover">Llenar el bloque (recorta)</option>
                  <option value="contain">Mostrar completa</option>
                </Select>

                <Input
                  name="overlay"
                  type="number"
                  min={0}
                  max={90}
                  label="Oscurecido"
                  help="0 deja la foto tal cual; súbelo hasta que el texto se lea."
                  defaultValue={block.overlay}
                />

                {esBanner ? (
                  <Input
                    name="intervalSec"
                    type="number"
                    min={2}
                    max={30}
                    label="Segundos por lámina"
                    help="Solo para las fotos: un video pasa cuando termina."
                    defaultValue={block.intervalSec}
                  />
                ) : (
                  <input type="hidden" name="intervalSec" value={block.intervalSec} />
                )}
              </>
            ) : (
              <>
                <input type="hidden" name="height" value={block.height} />
                <input type="hidden" name="align" value={block.align} />
                <input type="hidden" name="fit" value={block.fit} />
                <input type="hidden" name="overlay" value={block.overlay} />
                <input type="hidden" name="intervalSec" value={block.intervalSec} />
              </>
            )}

            <Select name="background" label="Fondo" defaultValue={block.background}>
              <option value="ink">Negro</option>
              <option value="oscuro">Negro suave</option>
              <option value="carbon">Carbón</option>
              <option value="acento">Color de acento</option>
            </Select>

            {conProductos || conTarjetas ? (
              <Select name="columns" label="Columnas" defaultValue={String(block.columns)}>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </Select>
            ) : (
              <input type="hidden" name="columns" value={block.columns} />
            )}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} full>
            {pending ? 'Guardando…' : 'Guardar bloque'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/inicio')}>
            Volver
          </Button>
        </div>

        {state ? (
          <p className={cn('text-[13px]', state.ok ? 'text-signal-ok' : 'text-signal-bad')}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
