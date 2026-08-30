'use server';

import { revalidatePath } from 'next/cache';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { AdminState } from './products';

/** Cambia el rol de un usuario. Solo un ADMIN puede hacerlo. */
export async function updateUserRole(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  if (admin.role !== 'ADMIN') {
    return { ok: false, message: 'Solo un administrador puede cambiar permisos.' };
  }

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as Role;

  if (userId === admin.id) {
    return { ok: false, message: 'No puedes cambiar tu propio rol.' };
  }
  if (!['CUSTOMER', 'STAFF', 'ADMIN'].includes(role)) {
    return { ok: false, message: 'Rol no válido.' };
  }

  // Nunca dejar la tienda sin ningún administrador.
  if (role !== 'ADMIN') {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) {
        return { ok: false, message: 'Debe quedar al menos un administrador.' };
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath(`/admin/clientes/${userId}`);
  revalidatePath('/admin/clientes');

  return { ok: true, message: 'Permisos actualizados.' };
}
