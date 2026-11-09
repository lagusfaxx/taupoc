import { NextResponse, type NextRequest } from 'next/server';
import { sendDueReviewRequests } from '@/lib/review-requests';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manda los correos que piden calificar los productos de pedidos entregados.
 * La tarea de reservas (cada minuto) ya lo hace cada 15 minutos; esta ruta
 * sirve para programarlo aparte o forzar una corrida.
 *
 * Se llama con Authorization: Bearer <CRON_TOKEN>. Sin CRON_TOKEN no existe.
 */
async function handle(request: NextRequest) {
  const token = process.env.CRON_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  return NextResponse.json(await sendDueReviewRequests());
}

export const GET = handle;
export const POST = handle;
