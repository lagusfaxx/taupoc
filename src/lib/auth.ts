import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { cookieSecure } from './cookies';

const COOKIE = 'taupoc_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 24) {
    throw new Error('AUTH_SECRET no está configurado o es demasiado corto (mínimo 24 caracteres).');
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 11);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await cookieSecure(),
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Lee la sesión del cookie. No consulta la base de datos. */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: (payload.role as Role) ?? 'CUSTOMER',
    };
  } catch {
    return null;
  }
}

/** Sesión verificada contra la base de datos (el rol puede haber cambiado). */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, lastName: true, role: true, phone: true, rut: true, clubName: true },
  });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/cuenta/ingresar');
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/ingresar');
  if (user.role !== 'ADMIN' && user.role !== 'STAFF') redirect('/admin/ingresar?error=permisos');
  return user;
}

export function isStaff(role?: Role | null): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}
