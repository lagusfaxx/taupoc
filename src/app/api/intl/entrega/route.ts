import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { deliveryLocationSchema } from '@/lib/delivery-location';
import { productDeliveryEstimates } from '@/lib/product-delivery';
import { enviaCountries } from '@/lib/envia';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const schema = z.object({
  productIds: z.array(z.string().min(1).max(80)).min(1).max(40),
  destination: deliveryLocationSchema.extend({
    postalCode: z
      .string()
      .trim()
      .min(2)
      .max(12)
      .regex(/^[A-Za-z0-9 -]+$/),
  }),
});

export async function GET() {
  return NextResponse.json({ countries: await enviaCountries() }, { headers });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`product-delivery:${ip}`, 30, 60_000)) {
    return NextResponse.json(
      { error: 'Espera un momento y vuelve a consultar.' },
      { status: 429, headers },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Revisa la localidad y el código postal.' },
      { status: 400, headers },
    );
  const estimates = await productDeliveryEstimates(
    [...new Set(parsed.data.productIds)],
    parsed.data.destination,
  );
  return NextResponse.json({ estimates }, { headers });
}
