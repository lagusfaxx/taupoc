import { NextResponse, type NextRequest } from 'next/server';
import { syncFactoryStock } from '@/lib/supplier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Consulta el stock de fábrica en la tienda B2B del proveedor. La tienda ya lo
 * hace sola cada media hora cuando alguien abre una ficha; esto es para una
 * tarea programada que lo mantenga al día sin tráfico.
 *
 * Se llama con Authorization: Bearer <CRON_TOKEN>. Sin CRON_TOKEN no existe.
 */
async function handle(request: NextRequest) {
  const token = process.env.CRON_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  return NextResponse.json(await syncFactoryStock());
}

export const GET = handle;
export const POST = handle;
