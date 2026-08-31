import 'server-only';
import { headers } from 'next/headers';

/**
 * Si el cookie de esta petición debe llevar `Secure`.
 *
 * Marcarlo siempre en producción rompe la sesión cuando el sitio se sirve por
 * http —un dominio de prueba tipo sslip.io todavía sin certificado—: el
 * navegador acepta la respuesta pero descarta el cookie, así que el ingreso
 * parece funcionar y en la siguiente página ya no hay sesión.
 *
 * Se mira el esquema real de la visita. Detrás de un proxy (Traefik en
 * Coolify) llega en `x-forwarded-proto`; sin proxy delante se usa el esquema
 * del sitio configurado.
 */
export async function cookieSecure(): Promise<boolean> {
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (proto) return proto === 'https';
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');
}
