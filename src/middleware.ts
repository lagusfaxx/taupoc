import { NextResponse, type NextRequest } from 'next/server';

/**
 * Expone la ruta actual como cabecera para que los layouts del servidor
 * puedan decidir según el pathname (Next no lo entrega a los layouts).
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|icon.svg).*)'],
};
