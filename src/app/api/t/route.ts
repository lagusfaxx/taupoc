import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, isStaff } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { STORE_HEADER } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

const schema = z.object({
  t: z.enum(['PAGE_VIEW', 'PRODUCT_VIEW', 'CHECKOUT_START', 'PURCHASE']),
  v: z.string().min(8).max(64).regex(/^[a-z0-9]+$/i),
  s: z.string().min(8).max(64).regex(/^[a-z0-9]+$/i),
  p: z.string().min(1).max(200).startsWith('/'),
  src: z.string().max(40).optional().nullable(),
  cmp: z.string().max(80).optional().nullable(),
  pid: z.string().max(40).optional().nullable(),
  on: z.string().max(24).optional().nullable(),
});

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

function deviceOf(ua: string): string {
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

const ok = () => new NextResponse(null, { status: 204 });

/**
 * Recibe los eventos de analítica propia. Siempre responde 204: quien mira la
 * tienda no tiene por qué enterarse de si el evento se guardó o se descartó.
 */
export async function POST(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return ok();

  let parsed;
  try {
    parsed = schema.safeParse(JSON.parse(await request.text()));
  } catch {
    return ok();
  }
  if (!parsed.success) return ok();
  const e = parsed.data;

  // El equipo navegando la tienda no es tráfico: ensuciaría la conversión.
  const session = await getSession();
  if (session && isStaff(session.role)) return ok();

  if (!rateLimit(`t:${e.v}`, 90, 60_000)) return ok();

  let productId: string | null = null;
  let orderNumber: string | null = null;

  if (e.t === 'PRODUCT_VIEW') {
    if (!e.pid) return ok();
    const product = await prisma.product.findUnique({ where: { id: e.pid }, select: { id: true } });
    if (!product) return ok();
    productId = product.id;
  }

  if (e.t === 'PURCHASE') {
    // Solo cuenta un pedido real y reciente, una sola vez.
    if (!e.on) return ok();
    const [order, seen] = await Promise.all([
      prisma.order.findUnique({ where: { number: e.on }, select: { createdAt: true } }),
      prisma.siteEvent.findFirst({ where: { type: 'PURCHASE', orderNumber: e.on }, select: { id: true } }),
    ]);
    if (!order || seen || Date.now() - order.createdAt.getTime() > 48 * 3600_000) return ok();
    orderNumber = e.on;
  }

  await prisma.siteEvent
    .create({
      data: {
        type: e.t,
        visitorId: e.v,
        sessionId: e.s,
        path: e.p,
        productId,
        orderNumber,
        source: (e.src || 'direct').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'direct',
        campaign: e.cmp || null,
        device: deviceOf(ua),
        storefront: request.headers.get(STORE_HEADER) === 'INTL' ? 'INTL' : 'CL',
      },
    })
    .catch(() => null);

  return ok();
}
