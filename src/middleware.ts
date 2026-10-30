import { NextResponse, type NextRequest } from 'next/server';
import { INTL_PREFIX, STORE_HEADER, storeFromHost, storeSiteUrl } from '@/lib/storefront';

/**
 * Redirige www → sin www, decide la tienda por el dominio y expone la ruta
 * como cabecera para los layouts.
 *
 * taupoc.cl sigue exactamente como estaba. En taupoc.lat cada página se
 * reescribe bajo /intl, donde viven el layout y los componentes de esa tienda;
 * la API es la misma para las dos y el panel existe solo en taupoc.cl.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Redirect www.taupoc.cl → taupoc.cl (y www.taupoc.lat → taupoc.lat) con 301.
  if (host.startsWith('www.')) {
    const newHost = host.slice(4); // Quita "www."
    const url = request.nextUrl.clone();
    url.host = newHost;
    return NextResponse.redirect(url, 301);
  }

  const store = storeFromHost(host);
  const { pathname, search } = request.nextUrl;

  // La tienda la decide el dominio: una cabecera x-store que mande el
  // navegador se pisa siempre.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  headers.set(STORE_HEADER, store);

  if (store === 'INTL') {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.redirect(`${storeSiteUrl('CL')}${pathname}${search}`, 308);
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.next({ request: { headers } });
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? INTL_PREFIX : `${INTL_PREFIX}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Las páginas de taupoc.lat no se ven desde taupoc.cl.
  if (pathname === INTL_PREFIX || pathname.startsWith(`${INTL_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = '/_no-existe';
    return NextResponse.rewrite(url, { request: { headers } });
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|icon.svg).*)'],
};
