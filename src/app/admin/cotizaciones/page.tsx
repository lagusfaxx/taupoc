import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/admin/PageHeader';
import { Toolbar } from '@/components/admin/Toolbar';
import { StatCard } from '@/components/admin/Card';
import { QuoteCard } from '@/components/admin/QuoteCard';
import { ButtonLink } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Cotizaciones', noIndex: true });

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;

  const query = one('q')?.trim();
  const status = one('estado');

  const where: Prisma.QuoteRequestWhereInput = {
    ...(query
      ? {
          OR: [
            { clubName: { contains: query, mode: 'insensitive' } },
            { contactName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [quotes, newCount, wonCount, athletes] = await Promise.all([
    prisma.quoteRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.quoteRequest.count({ where: { status: 'NEW' } }),
    prisma.quoteRequest.count({ where: { status: 'WON' } }),
    prisma.quoteRequest.aggregate({ _sum: { athletes: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Cotizaciones de clubes"
        description="Solicitudes recibidas desde la sección de clubes de la tienda."
        actions={
          <ButtonLink href="/api/admin/export/cotizaciones" variant="outline" size="sm" prefetch={false}>
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Sin responder" value={String(newCount)} tone={newCount > 0 ? 'warn' : 'ok'} />
        <StatCard label="Ganadas" value={String(wonCount)} tone="ok" />
        <StatCard label="Nadadores potenciales" value={String(athletes._sum.athletes ?? 0)} tone="accent" />
      </div>

      <Toolbar
        searchPlaceholder="Buscar por club, contacto o correo…"
        filters={[
          {
            name: 'estado',
            label: 'Todos los estados',
            options: [
              { value: 'NEW', label: 'Nueva' },
              { value: 'CONTACTED', label: 'Contactada' },
              { value: 'QUOTED', label: 'Cotizada' },
              { value: 'WON', label: 'Ganada' },
              { value: 'LOST', label: 'Perdida' },
            ],
          },
        ]}
      />

      <div className="space-y-4">
        {quotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={{
              id: quote.id,
              clubName: quote.clubName,
              contactName: quote.contactName,
              email: quote.email,
              phone: quote.phone,
              region: quote.region,
              athletes: quote.athletes,
              interest: quote.interest,
              message: quote.message,
              status: quote.status,
              adminNote: quote.adminNote,
              createdAt: quote.createdAt.toISOString(),
            }}
          />
        ))}
        {quotes.length === 0 ? (
          <p className="border border-line bg-ink-900 px-5 py-12 text-center text-[13.5px] text-chalk-faint">
            No hay cotizaciones que coincidan con la búsqueda.
          </p>
        ) : null}
      </div>
    </>
  );
}
