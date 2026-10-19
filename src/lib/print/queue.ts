import 'server-only';
import type { PrintJob } from '@prisma/client';
import { prisma } from '../db';
import { bearer, checkToken, ToolError } from '../mcp/protocol';

/**
 * Cola de impresión.
 *
 * El servidor no ve la impresora: está en el PC de la tienda. Claude encola
 * documentos (PDF ya armados) y el agente de impresión los pide cada pocos
 * segundos, los imprime y avisa el resultado. Si el agente descarga un
 * trabajo y no avisa en 10 minutos (se cortó la luz, se apagó el PC), el
 * trabajo vuelve a la cola.
 *
 * El agente vive en el repositorio de Wacaco (print-agent/) y atiende a las
 * dos tiendas: habla con esta por /api/print-agent/jobs.
 */

const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;
const KEEP_DAYS = 30;
const SEEN_KEY = 'printAgentSeen';

export function printQueueEnabled(): boolean {
  return checkToken('', 'PRINT_AGENT_TOKEN') !== 'disabled';
}

/** `Authorization: Bearer <PRINT_AGENT_TOKEN>`. */
export function agentAuthorized(header: string | null): boolean {
  return checkToken(bearer(header), 'PRINT_AGENT_TOKEN') === 'ok';
}

export async function enqueuePrint(input: {
  kind: string;
  title: string;
  refs: string[];
  pdf: Uint8Array;
  copies?: number;
}): Promise<PrintJob> {
  if (!printQueueEnabled()) {
    throw new ToolError(
      'La cola de impresión está apagada: define PRINT_AGENT_TOKEN (mínimo 24 caracteres) en el servidor y configura el agente de impresión.',
    );
  }
  // Limpieza oportunista: lo viejo ya no se va a reimprimir.
  await prisma.printJob
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } })
    .catch(() => undefined);

  return prisma.printJob.create({
    data: {
      kind: input.kind,
      title: input.title,
      refs: input.refs,
      pdf: Buffer.from(input.pdf),
      copies: input.copies ?? 1,
    },
  });
}

/** Referencias ya encoladas o impresas, para no repetirlas. */
export async function printedRefs(kind: string, statuses: PrintJob['status'][] = ['PENDING', 'PRINTED']) {
  const rows = await prisma.printJob.findMany({
    where: { kind, status: { in: statuses } },
    select: { refs: true },
  });
  return new Set(rows.flatMap((r) => r.refs));
}

// ── Lo que usa el agente ──────────────────────────────────────

export async function markAgentSeen(name: string) {
  const value = { at: new Date().toISOString(), name: name.slice(0, 80) };
  await prisma.setting
    .upsert({ where: { key: SEEN_KEY }, create: { key: SEEN_KEY, value }, update: { value } })
    .catch(() => undefined);
}

/** Pendientes que nadie tiene tomados, o cuyo agente no volvió a avisar. */
function available() {
  return {
    status: 'PENDING' as const,
    OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) } }],
  };
}

export async function jobsForAgent() {
  return prisma.printJob.findMany({
    where: available(),
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, kind: true, title: true, copies: true, createdAt: true },
  });
}

/** Entrega el PDF y marca el trabajo como tomado. null si ya no está disponible. */
export async function claimJob(id: string): Promise<PrintJob | null> {
  const claimed = await prisma.printJob.updateMany({
    where: { id, ...available() },
    data: { claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;
  return prisma.printJob.findUnique({ where: { id } });
}

export async function finishJob(id: string, result: { ok: boolean; error?: string }) {
  const job = await prisma.printJob.findUnique({ where: { id }, select: { status: true, attempts: true } });
  if (!job || job.status !== 'PENDING') return null;
  if (result.ok) {
    return prisma.printJob.update({ where: { id }, data: { status: 'PRINTED', printedAt: new Date(), error: null } });
  }
  // Un error de impresión se reintenta solo hasta MAX_ATTEMPTS veces.
  return prisma.printJob.update({
    where: { id },
    data: {
      status: job.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
      claimedAt: null,
      error: (result.error ?? 'Error sin detalle').slice(0, 500),
    },
  });
}

// ── Estado, para Claude ───────────────────────────────────────

export async function agentStatus() {
  if (!printQueueEnabled()) return { activo: false, mensaje: 'Falta PRINT_AGENT_TOKEN en el servidor.' };
  const row = await prisma.setting.findUnique({ where: { key: SEEN_KEY } });
  const seen = row?.value as { at?: string; name?: string } | undefined;
  if (!seen?.at) return { activo: true, conectado: false, mensaje: 'El agente de impresión nunca se ha conectado.' };
  const seconds = Math.round((Date.now() - new Date(seen.at).getTime()) / 1000);
  return {
    activo: true,
    conectado: seconds < 120,
    agente: seen.name,
    vistoHaceSegundos: seconds,
    mensaje:
      seconds < 120
        ? 'El agente está conectado: imprimirá en unos segundos.'
        : 'El agente no se conecta hace rato: lo encolado se imprimirá cuando el PC vuelva a estar encendido con el agente corriendo.',
  };
}

export async function queueOverview(limit = 20) {
  const trabajos = await prisma.printJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      refs: true,
      copies: true,
      status: true,
      attempts: true,
      error: true,
      createdAt: true,
      printedAt: true,
    },
  });
  return { agente: await agentStatus(), trabajos };
}

export async function cancelJob(id: string) {
  const res = await prisma.printJob.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  return res.count === 1;
}
