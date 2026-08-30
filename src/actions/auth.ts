'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import {
  createSession, destroySession, getSession, hashPassword, verifyPassword,
} from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendPasswordReset } from '@/lib/mail';
import { readCartToken } from '@/lib/cart';
import { siteUrl } from '@/lib/seo';

export interface AuthState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

async function clientKey(prefix: string) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return `${prefix}:${ip}`;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Asocia el carrito anónimo al usuario que acaba de autenticarse. */
async function attachCart(userId: string) {
  const token = await readCartToken();
  if (!token) return;
  await prisma.cart.updateMany({ where: { token }, data: { userId } }).catch(() => {});
}

const registerSchema = z
  .object({
    name: z.string().min(2, 'Ingresa tu nombre.'),
    lastName: z.string().optional(),
    email: z.string().email('Ingresa un correo válido.'),
    phone: z.string().optional(),
    clubName: z.string().optional(),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string(),
    acceptsMarketing: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.',
  });

export async function registerUser(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  if (!rateLimit(await clientKey('register'), 8, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera un minuto.' };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      message: 'Ya existe una cuenta con ese correo.',
      fieldErrors: { email: 'Este correo ya está registrado.' },
    };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: data.name.trim(),
      lastName: data.lastName?.trim() || null,
      phone: data.phone?.trim() || null,
      clubName: data.clubName?.trim() || null,
      passwordHash: await hashPassword(data.password),
      acceptsMarketing: data.acceptsMarketing === 'on',
      role: 'CUSTOMER',
    },
  });

  if (user.acceptsMarketing) {
    await prisma.newsletterSubscriber
      .upsert({ where: { email }, create: { email, source: 'registro' }, update: {} })
      .catch(() => {});
  }

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  await attachCart(user.id);
  revalidatePath('/', 'layout');
  redirect('/cuenta');
}

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
  redirectTo: z.string().optional(),
});

export async function loginUser(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  if (!rateLimit(await clientKey('login'), 10, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera un minuto antes de reintentar.' };
  }

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos.', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Mensaje genérico: no revelamos si el correo existe.
  const invalid: AuthState = { ok: false, message: 'Correo o contraseña incorrectos.' };
  if (!user?.passwordHash) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  await attachCart(user.id);
  revalidatePath('/', 'layout');

  const target = parsed.data.redirectTo;
  const safeTarget = target && target.startsWith('/') && !target.startsWith('//') ? target : null;
  redirect(safeTarget ?? (user.role === 'CUSTOMER' ? '/cuenta' : '/admin'));
}

export async function logoutUser() {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/');
}

const profileSchema = z.object({
  name: z.string().min(2, 'Ingresa tu nombre.'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  clubName: z.string().optional(),
  acceptsMarketing: z.string().optional(),
});

export async function updateProfile(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Debes iniciar sesión.' };

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos.', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      name: parsed.data.name.trim(),
      lastName: parsed.data.lastName?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      clubName: parsed.data.clubName?.trim() || null,
      acceptsMarketing: parsed.data.acceptsMarketing === 'on',
    },
  });

  revalidatePath('/cuenta');
  return { ok: true, message: 'Datos actualizados.' };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Ingresa tu contraseña actual.'),
    password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.',
  });

export async function changePassword(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Debes iniciar sesión.' };

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos.', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, message: 'La contraseña actual no es correcta.', fieldErrors: { current: 'Incorrecta.' } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { ok: true, message: 'Contraseña actualizada.' };
}

export async function requestPasswordReset(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  if (!rateLimit(await clientKey('reset'), 5, 300_000)) {
    return { ok: false, message: 'Demasiadas solicitudes. Intenta más tarde.' };
  }

  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  // Respuesta idéntica exista o no la cuenta, para no filtrar correos registrados.
  const generic: AuthState = {
    ok: true,
    message: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.',
  };
  if (!z.string().email().safeParse(email).success) return generic;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return generic;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  await sendPasswordReset(email, `${siteUrl()}/cuenta/restablecer?token=${token}`).catch(() => {});
  return generic;
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.',
  });

export async function resetPassword(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos.', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, message: 'El enlace no es válido o ya venció. Solicita uno nuevo.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await createSession({
    id: record.user.id,
    email: record.user.email,
    name: record.user.name,
    role: record.user.role,
  });
  redirect('/cuenta');
}

// ── Direcciones ───────────────────────────────────────────────

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  firstName: z.string().min(2, 'Ingresa el nombre.'),
  lastName: z.string().min(2, 'Ingresa el apellido.'),
  phone: z.string().min(8, 'Ingresa un teléfono.'),
  street: z.string().min(3, 'Ingresa la calle.'),
  number: z.string().min(1, 'Ingresa el número.'),
  extra: z.string().optional(),
  region: z.string().min(1, 'Selecciona la región.'),
  commune: z.string().min(1, 'Selecciona la comuna.'),
  postalCode: z.string().optional(),
  isDefault: z.string().optional(),
});

export async function saveAddress(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Debes iniciar sesión.' };

  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Revisa los datos.', fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const d = parsed.data;
  const isDefault = d.isDefault === 'on';

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: session.id }, data: { isDefault: false } });
  }

  const data = {
    label: d.label?.trim() || null,
    firstName: d.firstName,
    lastName: d.lastName,
    phone: d.phone,
    street: d.street,
    number: d.number,
    extra: d.extra?.trim() || null,
    region: d.region,
    commune: d.commune,
    city: d.commune,
    postalCode: d.postalCode?.trim() || null,
    isDefault,
  };

  if (d.id) {
    const owned = await prisma.address.findFirst({ where: { id: d.id, userId: session.id } });
    if (!owned) return { ok: false, message: 'Dirección no encontrada.' };
    await prisma.address.update({ where: { id: d.id }, data });
  } else {
    const count = await prisma.address.count({ where: { userId: session.id } });
    await prisma.address.create({
      data: { ...data, userId: session.id, isDefault: isDefault || count === 0 },
    });
  }

  revalidatePath('/cuenta/direcciones');
  return { ok: true, message: 'Dirección guardada.' };
}

export async function deleteAddress(id: string) {
  const session = await getSession();
  if (!session) return;
  await prisma.address.deleteMany({ where: { id, userId: session.id } });
  revalidatePath('/cuenta/direcciones');
}
