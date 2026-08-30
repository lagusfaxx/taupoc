'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveProduct, type AdminState } from '@/actions/admin/products';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Card } from './Card';
import { slugify } from '@/lib/utils';
import { formatNumber } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  modelCode: string;
  subtitle: string;
  description: string;
  status: string;
  gender: string;
  lineId: string;
  categoryId: string;
  approvalCode: string;
  approvalBody: string;
  approvalYear: string;
  approvalVerifyUrl: string;
  basePrice: string;
  compareAtPrice: string;
  weightGrams: string;
  composition: string;
  construction: string;
  finish: string;
  countryOrigin: string;
  careNotes: string;
  fitNotes: string;
  fitOffset: string;
  featured: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 accent-bg px-7 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

export function ProductForm({
  product,
  lines,
  categories,
}: {
  product: ProductFormData;
  lines: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveProduct, null);
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(product.slug));
  const e = state?.fieldErrors ?? {};

  const autoSlug = slugTouched ? slug : slugify(`${name} ${product.modelCode}`);

  return (
    <form action={action} className="space-y-5">
      {product.id ? <input type="hidden" name="id" value={product.id} /> : null}

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

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card title="Información general">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nombre"
                name="name"
                required
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                error={e.name}
                className="sm:col-span-2"
              />
              <Input
                label="Código de modelo"
                name="modelCode"
                required
                defaultValue={product.modelCode}
                placeholder="TS703"
                error={e.modelCode}
                help="El código del fabricante. Debe ser único."
              />
              <Input
                label="URL del producto"
                name="slug"
                value={autoSlug}
                onChange={(ev) => {
                  setSlugTouched(true);
                  setSlug(slugify(ev.target.value));
                }}
                error={e.slug}
                help={`taupoc.cl/producto/${autoSlug || '…'}`}
              />
              <Input
                label="Bajada"
                hint="opcional"
                name="subtitle"
                defaultValue={product.subtitle}
                placeholder="Jammer de competición masculino"
                className="sm:col-span-2"
              />
              <Textarea
                label="Descripción"
                name="description"
                rows={8}
                defaultValue={product.description}
                help="Separa los párrafos con una línea en blanco."
                className="sm:col-span-2"
              />
            </div>
          </Card>

          <Card title="Homologación World Aquatics" description="Es el principal argumento de venta: publícalo completo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Código de homologación"
                name="approvalCode"
                defaultValue={product.approvalCode}
                placeholder="TA146514"
                help="Aparece destacado en la ficha de producto."
              />
              <Input label="Entidad" name="approvalBody" defaultValue={product.approvalBody || 'World Aquatics'} />
              <Input label="Año de aprobación" name="approvalYear" type="number" defaultValue={product.approvalYear} placeholder="2024" />
              <Input
                label="URL de verificación"
                name="approvalVerifyUrl"
                defaultValue={product.approvalVerifyUrl}
                placeholder="https://www.worldaquatics.com/swimming/approved-swimwear"
              />
            </div>
          </Card>

          <Card title="Ficha técnica">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Composición" name="composition" defaultValue={product.composition} placeholder="72% Poliamida · 28% Elastano" className="sm:col-span-2" />
              <Input label="Construcción" name="construction" defaultValue={product.construction} placeholder="Bonding térmico sin costuras" />
              <Input label="Acabado" name="finish" defaultValue={product.finish} placeholder="Tratamiento hidrofóbico · UPF 50+" />
              <Input label="Origen" name="countryOrigin" defaultValue={product.countryOrigin} placeholder="Tejido italiano" />
              <Input label="Peso unitario (gramos)" name="weightGrams" type="number" defaultValue={product.weightGrams} help="Se usa para calcular el envío por peso." />
              <Textarea label="Cuidado" name="careNotes" rows={3} defaultValue={product.careNotes} className="sm:col-span-2" />
              <Textarea
                label="Notas de calce"
                name="fitNotes"
                rows={3}
                defaultValue={product.fitNotes}
                help="Se muestra en la tabla de tallas. Explica el uso 1-2 tallas por debajo."
                className="sm:col-span-2"
              />
              <Select label="Tallas a bajar por compresión" name="fitOffset" defaultValue={product.fitOffset || '1'}>
                <option value="0">Sin ajuste</option>
                <option value="1">1 talla</option>
                <option value="2">2 tallas</option>
              </Select>
            </div>
          </Card>

          <Card title="SEO">
            <div className="grid gap-4">
              <Input
                label="Título SEO"
                name="seoTitle"
                defaultValue={product.seoTitle}
                help="Si lo dejas vacío se usa el nombre del producto."
              />
              <Textarea
                label="Descripción SEO"
                name="seoDescription"
                rows={3}
                defaultValue={product.seoDescription}
                help="Idealmente entre 120 y 160 caracteres."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Estado y visibilidad">
            <div className="space-y-4">
              <Select label="Estado" name="status" defaultValue={product.status || 'DRAFT'}>
                <option value="DRAFT">Borrador — no visible</option>
                <option value="ACTIVE">Activo — a la venta</option>
                <option value="COMING_SOON">Próximamente — visible sin comprar</option>
                <option value="ARCHIVED">Archivado</option>
              </Select>
              <Select label="Género" name="gender" defaultValue={product.gender || 'UNISEX'}>
                <option value="MALE">Hombre</option>
                <option value="FEMALE">Mujer</option>
                <option value="UNISEX">Unisex</option>
              </Select>
              <Select label="Línea" name="lineId" defaultValue={product.lineId}>
                <option value="">Sin línea</option>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </Select>
              <Select label="Categoría" name="categoryId" defaultValue={product.categoryId}>
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
              <Input
                label="Orden en el catálogo"
                name="sortOrder"
                type="number"
                defaultValue={product.sortOrder || '0'}
                help="Menor número aparece primero."
              />
              <Checkbox name="featured" defaultChecked={product.featured} label="Destacar en la portada" />
            </div>
          </Card>

          <Card title="Precio">
            <div className="space-y-4">
              <Input
                label="Precio de venta"
                name="basePrice"
                required
                defaultValue={product.basePrice ? formatNumber(Number(product.basePrice)) : ''}
                placeholder="139.900"
                error={e.basePrice}
                help="En pesos chilenos, sin decimales."
              />
              <Input
                label="Precio de referencia"
                hint="opcional"
                name="compareAtPrice"
                defaultValue={product.compareAtPrice ? formatNumber(Number(product.compareAtPrice)) : ''}
                placeholder="219.900"
                help="Se muestra tachado, junto al porcentaje de descuento."
              />
            </div>
          </Card>

          <div className="sticky bottom-4 border border-line bg-ink-900 p-4">
            <Submit label={product.id ? 'Guardar cambios' : 'Crear producto'} />
            {!product.id ? (
              <p className="mt-3 text-[12px] leading-relaxed text-chalk-faint">
                Después de crearlo vas a poder cargar colores, tallas, stock e imágenes.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
