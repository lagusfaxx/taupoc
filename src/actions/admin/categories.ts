'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminState } from './products';

const rowSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(80),
  description: z.string().trim().max(200).optional().nullable(),
  active: z.boolean(),
});

const listSchema = z.array(rowSchema).max(30);

/** Slug a partir del nombre, cuando el panel lo deja en blanco. */
function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function saveCategories(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get('categorias') ?? '[]'));
  } catch {
    return { ok: false, message: 'No se pudieron leer las categorías. Vuelve a intentarlo.' };
  }

  const parsed = listSchema.safeParse(crudo);
  if (!parsed.success) {
    return { ok: false, message: 'Cada categoría necesita un nombre de al menos 2 caracteres.' };
  }

  const rows = parsed.data.map((row) => ({ ...row, slug: row.slug.trim() || slugify(row.name) }));

  const repetido = rows.find((row, i) => rows.findIndex((r) => r.slug === row.slug) !== i);
  if (repetido) {
    return { ok: false, message: `Hay dos categorías con la dirección "${repetido.slug}".` };
  }

  // Una categoría con productos no se borra: se desactiva. Borrarla dejaría
  // esos productos sin categoría sin avisar a nadie.
  const conservados = rows.map((r) => r.id).filter(Boolean) as string[];
  const sobrantes = await prisma.category.findMany({
    where: { id: { notIn: conservados } },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });

  const enUso = sobrantes.filter((c) => c._count.products > 0);
  if (enUso.length > 0) {
    return {
      ok: false,
      message: `No se puede borrar "${enUso[0]!.name}": tiene ${enUso[0]!._count.products} productos. Muévelos a otra categoría primero.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (sobrantes.length > 0) {
      await tx.category.deleteMany({ where: { id: { in: sobrantes.map((c) => c.id) } } });
    }

    for (const [i, row] of rows.entries()) {
      const data = {
        name: row.name,
        slug: row.slug,
        description: row.description?.trim() || null,
        sortOrder: i,
        active: row.active,
      };
      if (row.id) {
        await tx.category.update({ where: { id: row.id }, data });
      } else {
        await tx.category.create({ data });
      }
    }
  });

  revalidatePath('/', 'layout');
  revalidatePath('/catalogo');
  return { ok: true, message: `Categorías guardadas: ${rows.length}.` };
}
