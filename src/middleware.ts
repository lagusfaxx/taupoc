import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirige www → sin www, y expone la ruta como cabecera para layouts.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Redirect www.taupoc.cl → taupoc.cl con 301 permanente.
  if (host.startsWith('www.')) {
    const newHost = host.slice(4); // Quita "www."
    const url = request.nextUrl.clone();
    url.host = newHost;
    return NextResponse.redirect(url, 301);
  }

  // Expone el pathname para que los layouts del servidor puedan acceder.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|icon.svg).*)'],
};
