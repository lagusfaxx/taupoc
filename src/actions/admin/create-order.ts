'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { adminOrderSchema } from '@/lib/admin-order-input';
import { createAdminOrder } from '@/lib/admin-orders';

export async function submitAdminOrder(
  _previous: { message: string } | null,
  form: FormData,
): Promise<{ message: string }> {
  const admin = await requireAdmin();
  let items: unknown;
  try {
    items = JSON.parse(String(form.get('items') ?? '[]'));
  } catch {
    return { message: 'Revisa los productos.' };
  }
  const parsed = adminOrderSchema.safeParse({ ...Object.fromEntries(form), items });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  let id: string;
  try {
    id = await createAdminOrder(parsed.data, admin.email);
  } catch (error) {
    console.error('[create-order]', error);
    return {
      message:
        error instanceof Error &&
        [
          'El descuento supera el subtotal.',
          'Un producto ya no existe. Recarga el catálogo.',
          'El importe del pedido es demasiado alto.',
        ].includes(error.message)
          ? error.message
          : 'No se pudo completar el pedido. Reintenta con este mismo formulario.',
    };
  }
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin/reportes');
  revalidatePath('/admin/inventario');
  redirect(`/admin/pedidos/${id}`);
}
