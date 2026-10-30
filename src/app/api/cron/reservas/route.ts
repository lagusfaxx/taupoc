import { NextResponse, type NextRequest } from 'next/server';
import { releaseExpiredReservations } from '@/lib/reservations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Libera las reservas de stock vencidas. La tienda ya lo hace sola cuando
 * alguien navega o compra; esto es para que una tarea programada (Coolify,
 * cada minuto) lo haga aunque no haya tráfico.
 *
 * Se llama con Authorization: Bearer <CRON_TOKEN>. Sin CRON_TOKEN no existe.
 */
async function handle(request: NextRequest) {
  const token = process.env.CRON_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const released = await releaseExpiredReservations();
  return NextResponse.json({ released });
}

export const GET = handle;
export const POST = handle;
