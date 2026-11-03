import 'server-only';
import { headers } from 'next/headers';
import { STORE_HEADER, type Storefront } from './storefront';

/**
 * La tienda de la solicitud en curso, según la dejó el middleware. Se usa en
 * el layout raíz y en las acciones y rutas que comparten las dos tiendas; las
 * páginas bajo /intl ya saben que son INTL.
 */
export async function getStore(): Promise<Storefront> {
  return (await headers()).get(STORE_HEADER) === 'INTL' ? 'INTL' : 'CL';
}
