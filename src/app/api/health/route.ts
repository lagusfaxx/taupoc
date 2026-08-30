import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Sonda de salud para Coolify y el healthcheck de Docker. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'down', time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
