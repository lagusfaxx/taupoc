'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { setStock } from '@/lib/inventory';
import { storeImage, deleteImage } from '@/lib/uploads';
import { parseCLP } from '@/lib/money';

export interface AdminState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Id del recurso creado o actualizado, para que el cliente navegue. */
  id?: string;
}

function errorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function revalidateCatalog(slug?: string) {
  revalidatePath('/admin/productos');
  revalidatePath('/catalogo');
  revalidatePath('/');
  if (slug) revalidatePath(`/producto/${slug}`);
}

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Ingresa el nombre del producto.'),
  slug: z.string().optional(),
  modelCode: z.string().min(2, 'Ingresa el código de modelo (ej. TS703).'),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMING_SOON', 'ARCHIVED']),
  gender: z.enum(['MALE', 'FEMALE', 'UNISEX']),
  lineId: z.string().optional(),
  categoryId: z.string().optional(),
  approvalCode: z.string().optional(),
  approvalBody: z.string().optional(),
  approvalYear: z.string().optional(),
  approvalVerifyUrl: z.string().optional(),
  basePrice: z.string().min(1, 'Ingresa el precio.'),
  compareAtPrice: z.string().optional(),
  weightGrams: z.string().optional(),
  composition: z.string().optional(),
  construction: z.string().optional(),
  finish: z.string().optional(),
  countryOrigin: z.string().optional(),
  careNotes: z.string().optional(),
  fitNotes: z.string().optional(),
  fitOffset: z.string().optional(),
  featured: z.string().optional(),
  sortOrder: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export async function saveProduct(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los campos marcados.', fieldErrors: errorsOf(parsed.error) };
  }
  const d = parsed.data;

  const basePrice = parseCLP(d.basePrice);
  if (basePrice <= 0) {
    return { ok: false, message: 'El precio debe ser mayor a cero.', fieldErrors: { basePrice: 'Precio inválido.' } };
  }

  const slug = slugify(d.slug || `${d.name} ${d.modelCode}`);
  const data = {
    name: d.name.trim(),
    slug,
    modelCode: d.modelCode.trim().toUpperCase(),
    subtitle: d.subtitle?.trim() || null,
    description: d.description ?? '',
    status: d.status,
    gender: d.gender,
    lineId: d.lineId || null,
    categoryId: d.categoryId || null,
    approvalCode: d.approvalCode?.trim().toUpperCase() || null,
    approvalBody: d.approvalBody?.trim() || 'World Aquatics',
    approvalYear: d.approvalYear ? Number(d.approvalYear) || null : null,
    approvalVerifyUrl: d.approvalVerifyUrl?.trim() || null,
    basePrice,
    compareAtPrice: d.compareAtPrice ? parseCLP(d.compareAtPrice) || null : null,
    weightGrams: d.weightGrams ? Number(d.weightGrams) || 180 : 180,
    composition: d.composition?.trim() || null,
    construction: d.construction?.trim() || null,
    finish: d.finish?.trim() || null,
    countryOrigin: d.countryOrigin?.trim() || null,
    careNotes: d.careNotes?.trim() || null,
    fitNotes: d.fitNotes?.trim() || null,
    fitOffset: d.fitOffset ? Number(d.fitOffset) || 1 : 1,
    featured: d.featured === 'on',
    sortOrder: d.sortOrder ? Number(d.sortOrder) || 0 : 0,
    seoTitle: d.seoTitle?.trim() || null,
    seoDescription: d.seoDescription?.trim() || null,
  };

  // El slug y el código de modelo son únicos: avisamos con un mensaje claro.
  const clash = await prisma.product.findFirst({
    where: {
      OR: [{ slug }, { modelCode: data.modelCode }],
      ...(d.id ? { NOT: { id: d.id } } : {}),
    },
  });
  if (clash) {
    return {
      ok: false,
      message: 'Ya existe otro producto con ese código de modelo o esa URL.',
      fieldErrors:
        clash.modelCode === data.modelCode
          ? { modelCode: 'Este código ya está en uso.' }
          : { slug: 'Esta URL ya está en uso.' },
    };
  }

  if (d.id) {
    const product = await prisma.product.update({ where: { id: d.id }, data });
    revalidateCatalog(product.slug);
    return { ok: true, message: 'Producto actualizado.', id: product.id };
  }

  const product = await prisma.product.create({ data });
  revalidateCatalog(product.slug);
  redirect(`/admin/productos/${product.id}?creado=1`);
}

export async function duplicateProduct(id: string) {
  await requireAdmin();
  const source = await prisma.product.findUnique({
    where: { id },
    include: {
      colors: { include: { variants: true } },
      specs: true,
      sizeChart: true,
    },
  });
  if (!source) return;

  let slug = `${source.slug}-copia`;
  let suffix = 2;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${source.slug}-copia-${suffix++}`;
  }
  let modelCode = `${source.modelCode}-COPIA`;
  suffix = 2;
  while (await prisma.product.findUnique({ where: { modelCode } })) {
    modelCode = `${source.modelCode}-COPIA${suffix++}`;
  }

  const copy = await prisma.product.create({
    data: {
      name: `${source.name} (copia)`,
      slug,
      modelCode,
      subtitle: source.subtitle,
      description: source.description,
      // La copia nace como borrador para que no se publique por accidente.
      status: 'DRAFT',
      gender: source.gender,
      lineId: source.lineId,
      categoryId: source.categoryId,
      approvalCode: null,
      approvalBody: source.approvalBody,
      approvalVerifyUrl: source.approvalVerifyUrl,
      basePrice: source.basePrice,
      compareAtPrice: source.compareAtPrice,
      weightGrams: source.weightGrams,
      composition: source.composition,
      construction: source.construction,
      finish: source.finish,
      countryOrigin: source.countryOrigin,
      careNotes: source.careNotes,
      fitNotes: source.fitNotes,
      fitOffset: source.fitOffset,
      specs: { create: source.specs.map((s) => ({ label: s.label, value: s.value, sortOrder: s.sortOrder })) },
      sizeChart: {
        create: source.sizeChart.map((r) => ({
          size: r.size,
          chestMinCm: r.chestMinCm, chestMaxCm: r.chestMaxCm,
          waistMinCm: r.waistMinCm, waistMaxCm: r.waistMaxCm,
          hipMinCm: r.hipMinCm, hipMaxCm: r.hipMaxCm,
          heightMinCm: r.heightMinCm, heightMaxCm: r.heightMaxCm,
          cn: r.cn, usa: r.usa, uk: r.uk, aus: r.aus, nz: r.nz,
          sortOrder: r.sortOrder,
        })),
      },
    },
  });

  // Colores y variantes con stock en cero: la copia parte sin inventario.
  for (const color of source.colors) {
    const newColor = await prisma.productColor.create({
      data: {
        productId: copy.id,
        name: color.name,
        slug: color.slug,
        hex: color.hex,
        hexSecondary: color.hexSecondary,
        accentHex: color.accentHex,
        sortOrder: color.sortOrder,
      },
    });
    await prisma.variant.createMany({
      data: color.variants.map((v) => ({
        productId: copy.id,
        colorId: newColor.id,
        size: v.size,
        sku: `${modelCode}-${color.slug.toUpperCase().slice(0, 3)}-${v.size}`,
        stock: 0,
        lowStockThreshold: v.lowStockThreshold,
        sortOrder: v.sortOrder,
      })),
    });
  }

  revalidateCatalog();
  redirect(`/admin/productos/${copy.id}?duplicado=1`);
}

export async function setProductStatus(id: string, status: 'DRAFT' | 'ACTIVE' | 'COMING_SOON' | 'ARCHIVED') {
  await requireAdmin();
  const product = await prisma.product.update({ where: { id }, data: { status } });
  revalidateCatalog(product.slug);
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true, _count: { select: { orderItems: true } } },
  });
  if (!product) return;

  // Un producto con ventas no se borra: se archiva, para no romper el historial.
  if (product._count.orderItems > 0) {
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    revalidateCatalog(product.slug);
    redirect('/admin/productos?archivado=1');
  }

  await Promise.all(product.images.map((image) => deleteImage(image.url)));
  await prisma.product.delete({ where: { id } });
  revalidateCatalog(product.slug);
  redirect('/admin/productos?eliminado=1');
}

// ── Colores ───────────────────────────────────────────────────

const colorSchema = z.object({
  productId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().min(1, 'Ingresa el nombre del color.'),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB.'),
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB.'),
  sortOrder: z.string().optional(),
});

export async function saveColor(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = colorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos del color.', fieldErrors: errorsOf(parsed.error) };
  }
  const d = parsed.data;
  const slug = slugify(d.name);

  const product = await prisma.product.findUnique({ where: { id: d.productId } });
  if (!product) return { ok: false, message: 'Producto no encontrado.' };

  if (d.id) {
    await prisma.productColor.update({
      where: { id: d.id },
      data: {
        name: d.name.trim(),
        hex: d.hex,
        accentHex: d.accentHex,
        sortOrder: d.sortOrder ? Number(d.sortOrder) || 0 : 0,
      },
    });
  } else {
    const exists = await prisma.productColor.findUnique({
      where: { productId_slug: { productId: d.productId, slug } },
    });
    if (exists) return { ok: false, message: 'Ya existe un color con ese nombre en este producto.' };

    const count = await prisma.productColor.count({ where: { productId: d.productId } });
    const color = await prisma.productColor.create({
      data: {
        productId: d.productId,
        name: d.name.trim(),
        slug,
        hex: d.hex,
        accentHex: d.accentHex,
        sortOrder: count,
      },
    });

    // Un color nuevo hereda las tallas ya definidas en el producto.
    const sizes = await prisma.variant.findMany({
      where: { productId: d.productId },
      select: { size: true },
      distinct: ['size'],
      orderBy: { size: 'asc' },
    });
    const useSizes = sizes.length > 0
      ? sizes.map((s) => s.size)
      : ['20', '22', '24', '26', '28', '30', '32', '34', '36'];

    await prisma.variant.createMany({
      data: useSizes.map((size, i) => ({
        productId: d.productId,
        colorId: color.id,
        size,
        sku: `${product.modelCode}-${slug.toUpperCase().slice(0, 3)}-${size}`,
        stock: 0,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
  }

  revalidateCatalog(product.slug);
  return { ok: true, message: 'Color guardado.' };
}

export async function deleteColor(id: string) {
  await requireAdmin();
  const color = await prisma.productColor.findUnique({
    where: { id },
    include: { images: true, product: { select: { slug: true } } },
  });
  if (!color) return;
  await Promise.all(color.images.map((image) => deleteImage(image.url)));
  await prisma.productColor.delete({ where: { id } });
  revalidateCatalog(color.product.slug);
}

// ── Variantes (matriz talla × color) ───────────────────────────

/**
 * Guarda la matriz completa de stock. Recibe pares `stock:<variantId>` y
 * `active:<variantId>` desde la planilla, y solo escribe lo que cambió.
 */
export async function saveVariantMatrix(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return { ok: false, message: 'Producto no encontrado.' };

  const variants = await prisma.variant.findMany({ where: { productId } });
  const byId = new Map(variants.map((v) => [v.id, v]));

  let changed = 0;
  const activeFlags = new Set(
    [...formData.keys()].filter((k) => k.startsWith('active:')).map((k) => k.slice(7)),
  );

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('stock:')) continue;
    const id = key.slice(6);
    const variant = byId.get(id);
    if (!variant) continue;

    const stock = Math.max(0, Number(value) || 0);
    const active = activeFlags.has(id);

    if (variant.stock !== stock) {
      await setStock({
        variantId: id,
        stock,
        actorEmail: admin.email,
        reason: 'Edición en la matriz de variantes',
      });
      changed++;
    }
    if (variant.active !== active) {
      await prisma.variant.update({ where: { id }, data: { active } });
      changed++;
    }
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  revalidateCatalog(product?.slug);
  revalidatePath('/admin/inventario');

  return {
    ok: true,
    message: changed === 0 ? 'No había cambios que guardar.' : `${changed} cambios guardados.`,
  };
}

/** Agrega una talla nueva a todos los colores del producto. */
export async function addSize(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const size = String(formData.get('size') ?? '').trim();
  if (!productId || !size) return { ok: false, message: 'Ingresa la talla.' };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { colors: true },
  });
  if (!product) return { ok: false, message: 'Producto no encontrado.' };

  await prisma.variant.createMany({
    data: product.colors.map((color) => ({
      productId,
      colorId: color.id,
      size,
      sku: `${product.modelCode}-${color.slug.toUpperCase().slice(0, 3)}-${size}`,
      stock: 0,
      sortOrder: Number(size) || 0,
    })),
    skipDuplicates: true,
  });

  revalidateCatalog(product.slug);
  return { ok: true, message: `Talla ${size} agregada a ${product.colors.length} colores.` };
}

export async function removeSize(productId: string, size: string) {
  await requireAdmin();
  await prisma.variant.deleteMany({ where: { productId, size } });
  const product = await prisma.product.findUnique({ where: { id: productId } });
  revalidateCatalog(product?.slug);
}

// ── Imágenes ──────────────────────────────────────────────────

export async function uploadProductImages(formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const colorId = String(formData.get('colorId') ?? '') || null;
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  if (!productId || files.length === 0) {
    return { ok: false, message: 'Selecciona al menos una imagen.' };
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, message: 'Producto no encontrado.' };

  const existing = await prisma.productImage.count({ where: { productId } });
  let index = existing;

  for (const file of files) {
    try {
      const stored = await storeImage(file);
      await prisma.productImage.create({
        data: {
          productId,
          colorId,
          url: stored.url,
          width: stored.width,
          height: stored.height,
          alt: product.name,
          sortOrder: index++,
          isPrimary: existing === 0 && index === 1,
        },
      });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo subir la imagen.' };
    }
  }

  revalidateCatalog(product.slug);
  return { ok: true, message: `${files.length} ${files.length === 1 ? 'imagen subida' : 'imágenes subidas'}.` };
}

export async function assignImageColor(imageId: string, colorId: string | null) {
  await requireAdmin();
  const image = await prisma.productImage.update({
    where: { id: imageId },
    data: { colorId },
    include: { product: { select: { slug: true } } },
  });
  revalidateCatalog(image.product.slug);
}

export async function setPrimaryImage(imageId: string) {
  await requireAdmin();
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId: image.productId }, data: { isPrimary: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  const product = await prisma.product.findUnique({ where: { id: image.productId } });
  revalidateCatalog(product?.slug);
}

export async function reorderImages(ids: string[]) {
  await requireAdmin();
  await prisma.$transaction(
    ids.map((id, i) => prisma.productImage.update({ where: { id }, data: { sortOrder: i } })),
  );
  revalidateCatalog();
}

export async function deleteProductImage(imageId: string) {
  await requireAdmin();
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { slug: true } } },
  });
  if (!image) return;
  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteImage(image.url);
  revalidateCatalog(image.product.slug);
}

// ── Ficha técnica y tabla de tallas ───────────────────────────

export async function saveSpecs(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return { ok: false, message: 'Producto no encontrado.' };

  const labels = formData.getAll('specLabel').map(String);
  const values = formData.getAll('specValue').map(String);

  const rows = labels
    .map((label, i) => ({ label: label.trim(), value: (values[i] ?? '').trim(), sortOrder: i }))
    .filter((row) => row.label && row.value);

  await prisma.$transaction([
    prisma.productSpec.deleteMany({ where: { productId } }),
    prisma.productSpec.createMany({ data: rows.map((r) => ({ ...r, productId })) }),
  ]);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  revalidateCatalog(product?.slug);
  return { ok: true, message: `Ficha técnica guardada (${rows.length} filas).` };
}

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};

export async function saveSizeChart(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return { ok: false, message: 'Producto no encontrado.' };

  const sizes = formData.getAll('rowSize').map(String);
  const get = (name: string) => formData.getAll(name);

  const chest = { min: get('chestMin'), max: get('chestMax') };
  const waist = { min: get('waistMin'), max: get('waistMax') };
  const hip = { min: get('hipMin'), max: get('hipMax') };
  const height = { min: get('heightMin'), max: get('heightMax') };
  const cn = get('cn'); const usa = get('usa'); const uk = get('uk');
  const aus = get('aus'); const nz = get('nz');

  const rows = sizes
    .map((size, i) => ({
      size: size.trim(),
      chestMinCm: num(chest.min[i]), chestMaxCm: num(chest.max[i]),
      waistMinCm: num(waist.min[i]), waistMaxCm: num(waist.max[i]),
      hipMinCm: num(hip.min[i]), hipMaxCm: num(hip.max[i]),
      heightMinCm: num(height.min[i]), heightMaxCm: num(height.max[i]),
      cn: String(cn[i] ?? '').trim() || null,
      usa: String(usa[i] ?? '').trim() || null,
      uk: String(uk[i] ?? '').trim() || null,
      aus: String(aus[i] ?? '').trim() || null,
      nz: String(nz[i] ?? '').trim() || null,
      sortOrder: i,
    }))
    .filter((row) => row.size);

  await prisma.$transaction([
    prisma.sizeChartRow.deleteMany({ where: { productId } }),
    prisma.sizeChartRow.createMany({ data: rows.map((r) => ({ ...r, productId })) }),
  ]);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  revalidateCatalog(product?.slug);
  return { ok: true, message: `Tabla de tallas guardada (${rows.length} filas).` };
}
