'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminState } from './products';

const childSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(300),
  note: z.string().trim().max(120).optional().nullable(),
  active: z.boolean(),
});

const itemSchema = childSchema.extend({
  children: z.array(childSchema).max(12),
});

const menuSchema = z.array(itemSchema).max(10);

/**
 * Un destino solo puede ser una ruta de esta tienda o una dirección http(s).
 *
 * El campo lo escribe alguien del panel, pero termina en un `href` que se le
 * sirve a cualquier visitante: sin este filtro, un `javascript:` guardado por
 * error —o por alguien con acceso al panel— se ejecutaría en el navegador de
 * quien pase el mouse por el menú.
 */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.startsWith('/')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

export async function saveMenu(_prev: AdminState | null, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get('menu') ?? '[]'));
  } catch {
    return { ok: false, message: 'No se pudo leer el menú. Vuelve a intentarlo.' };
  }

  const parsed = menuSchema.safeParse(crudo);
  if (!parsed.success) {
    return { ok: false, message: 'Cada enlace necesita un texto y un destino.' };
  }

  // Se valida todo antes de escribir: a medio guardar, el menú de la tienda
  // quedaría con la mitad de los enlaces.
  const items = parsed.data.map((item) => {
    const href = safeHref(item.href);
    const children = item.children.map((child) => ({ ...child, href: safeHref(child.href) }));
    return { ...item, href, children };
  });

  const invalido =
    items.find((item) => !item.href) ??
    items.flatMap((item) => item.children).find((child) => !child.href);
  if (invalido) {
    return {
      ok: false,
      message: `El destino de "${invalido.label}" no sirve. Usa una ruta como /catalogo o una dirección https://…`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // El menú se reescribe entero. Es una lista corta y ordenada: emparejar
    // filas por id para conservarlas daría el mismo resultado con mucha más
    // maquinaria, y los hijos se van solos por la cascada del padre.
    await tx.menuItem.deleteMany({ where: { parentId: null } });

    for (const [i, item] of items.entries()) {
      await tx.menuItem.create({
        data: {
          label: item.label,
          href: item.href!,
          note: item.note?.trim() || null,
          position: i,
          active: item.active,
          children: {
            create: item.children.map((child, j) => ({
              label: child.label,
              href: child.href!,
              note: child.note?.trim() || null,
              position: j,
              active: child.active,
            })),
          },
        },
      });
    }
  });

  // El encabezado vive en el layout de la tienda: se revalida todo.
  revalidatePath('/', 'layout');
  return { ok: true, message: `Menú guardado con ${items.length} enlaces.` };
}

/** Descarta el menú guardado y devuelve el de por defecto. */
export async function resetMenu(): Promise<AdminState> {
  await requireAdmin();
  await prisma.menuItem.deleteMany({});
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Menú restablecido: la tienda vuelve al menú por defecto.' };
}
