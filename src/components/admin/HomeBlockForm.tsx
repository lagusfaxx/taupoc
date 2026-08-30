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
  productIds: string[];
  cards: { label: string; caption: string; href: string; imageUrl: string }[];
}

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
  const [cards, setCards] = useState(
    block.cards.length > 0 ? block.cards : [{ label: '', caption: '', href: '', imageUrl: '' }],
  );

  const conMedio = TIPO_MEDIO.includes(block.type);
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

            {block.type !== 'MEDIA' ? (
              <>
                <Input name="eyebrow" label="Antetítulo" defaultValue={block.eyebrow ?? ''} />
                <Input name="title" label="Título" defaultValue={block.title ?? ''} />
                <Input name="subtitle" label="Bajada" defaultValue={block.subtitle ?? ''} />
              </>
            ) : (
              <>
                <input type="hidden" name="eyebrow" value="" />
                <input type="hidden" name="title" value={block.title ?? ''} />
                <input type="hidden" name="subtitle" value="" />
              </>
            )}

            {block.type === 'TEXTO' ? (
              <Textarea name="body" label="Texto" rows={5} defaultValue={block.body ?? ''} />
            ) : (
              <input type="hidden" name="body" value={block.body ?? ''} />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="ctaLabel" label="Botón" defaultValue={block.ctaLabel ?? ''} />
              <Input
                name="ctaHref"
                label="Enlace del botón"
                placeholder="/catalogo"
                defaultValue={block.ctaHref ?? ''}
              />
            </div>

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
                <input type="hidden" name="ctaAltLabel" value="" />
                <input type="hidden" name="ctaAltHref" value="" />
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

        {conTarjetas ? (
          <Card title="Tarjetas" description="Cada una es un acceso con su foto y su enlace.">
            <div className="grid gap-4">
              {cards.map((card, index) => (
                <div key={index} className="grid gap-3 border border-line bg-ink p-4">
                  <div className="flex items-center justify-between">
                    <Label>Tarjeta {index + 1}</Label>
                    <button
                      type="button"
                      onClick={() => setCards((current) => current.filter((_, i) => i !== index))}
                      className="text-[12px] text-chalk-faint hover:text-signal-bad"
                    >
                      Quitar
                    </button>
                  </div>

                  <input type="hidden" name="cardLabel" value={card.label} />
                  <input type="hidden" name="cardCaption" value={card.caption} />
                  <input type="hidden" name="cardHref" value={card.href} />
                  <input type="hidden" name="cardImage" value={card.imageUrl} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Título"
                      value={card.label}
                      onChange={(event) => updateCard(index, { label: event.target.value })}
                    />
                    <Input
                      label="Enlace"
                      placeholder="/catalogo?genero=MALE"
                      value={card.href}
                      onChange={(event) => updateCard(index, { href: event.target.value })}
                    />
                  </div>

                  <Input
                    label="Nota"
                    value={card.caption}
                    onChange={(event) => updateCard(index, { caption: event.target.value })}
                  />

                  <MediaField
                    label="Foto"
                    value={card.imageUrl}
                    onChange={(imageUrl) => updateCard(index, { imageUrl })}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCards((current) => [...current, { label: '', caption: '', href: '', imageUrl: '' }])
                }
              >
                <IconPlus className="h-3.5 w-3.5" />
                Agregar tarjeta
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-5">
        <Card title="Presentación">
          <div className="grid gap-4">
            <Checkbox name="active" label="Visible en el inicio" defaultChecked={block.active} />

            {conMedio ? (
              <>
                <Select name="height" label="Alto" defaultValue={block.height}>
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
              </>
            ) : (
              <>
                <input type="hidden" name="height" value={block.height} />
                <input type="hidden" name="align" value={block.align} />
                <input type="hidden" name="fit" value={block.fit} />
                <input type="hidden" name="overlay" value={block.overlay} />
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
