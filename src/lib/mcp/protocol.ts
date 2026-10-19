import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import { prisma } from '../db';

/**
 * Servidor MCP mínimo sobre HTTP (transporte "Streamable HTTP" sin estado).
 *
 * Cada POST trae un mensaje JSON-RPC —o un lote— y se responde con JSON en
 * la misma petición. No se abren flujos SSE ni se guardan sesiones: todas
 * las herramientas terminan en una sola respuesta, así que no hace falta, y
 * el contenedor puede reiniciarse sin cortar a nadie.
 *
 * Se escribió a mano en vez de sumar el SDK oficial porque el protocolo que
 * se usa acá son cuatro métodos, y el resto de la tienda tampoco arrastra
 * dependencias que no necesita.
 */

const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'];

export interface McpTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** No cambia nada: Claude puede llamarla sin pensarlo dos veces. */
  readOnly?: boolean;
  /** Borra o pisa datos de forma difícil de deshacer. */
  destructive?: boolean;
  run: (args: z.infer<S>) => Promise<unknown>;
}

/** Ayuda de tipos: infiere `args` a partir del esquema. */
export function tool<S extends z.ZodObject>(def: McpTool<S>): McpTool {
  return def as unknown as McpTool;
}

/** Error que se le muestra a Claude tal cual, sin traza. */
export class ToolError extends Error {}

// ── Autenticación ─────────────────────────────────────────────

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * El token va en `Authorization: Bearer …` o como último tramo de la URL
 * (`/api/mcp/<token>`). Lo segundo existe porque los conectores
 * personalizados de claude.ai no permiten fijar cabeceras.
 */
export function checkToken(
  provided: string | null | undefined,
  envVar: 'MCP_TOKEN' | 'PRINT_AGENT_TOKEN' = 'MCP_TOKEN',
): 'ok' | 'disabled' | 'denied' {
  const expected = process.env[envVar]?.trim();
  if (!expected || expected.length < 24) return 'disabled';
  if (!provided) return 'denied';
  return timingSafeEqual(digest(provided.trim()), digest(expected)) ? 'ok' : 'denied';
}

export function bearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// ── JSON-RPC ──────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type RpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string; data?: unknown } };

function fail(id: RpcRequest['id'], code: number, message: string): RpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function inputSchema(schema: z.ZodObject) {
  // `io: 'input'` deja como opcionales los campos con valor por defecto.
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** BigInt, Date y Buffer no pasan por JSON.stringify sin ayuda. */
export function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
      if (v && typeof v === 'object' && (v as { type?: string }).type === 'Buffer' && Array.isArray((v as { data?: unknown }).data)) {
        return `<binario ${(v as { data: unknown[] }).data.length} bytes>`;
      }
      if (v instanceof Uint8Array) return `<binario ${v.byteLength} bytes>`;
      return v;
    },
    2,
  );
}

async function callTool(tools: McpTool[], params: Record<string, unknown> | undefined) {
  const name = String(params?.name ?? '');
  const def = tools.find((t) => t.name === name);
  if (!def) return { content: [{ type: 'text', text: `No existe la herramienta «${name}».` }], isError: true };

  const started = Date.now();
  const parsed = def.input.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
    return { content: [{ type: 'text', text: `Argumentos inválidos. ${detail}` }], isError: true };
  }

  let ok = true;
  let text: string;
  try {
    const result = await def.run(parsed.data);
    text = typeof result === 'string' ? result : toJson(result);
  } catch (error) {
    ok = false;
    text = error instanceof ToolError ? error.message : `Error interno: ${(error as Error)?.message ?? error}`;
    if (!(error instanceof ToolError)) console.error(`[mcp:${name}]`, error);
  }

  // Las de solo lectura no se registran: llenarían la bitácora de consultas
  // y lo que interesa auditar es lo que cambió.
  if (!def.readOnly || !ok) {
    await prisma.mcpLog
      .create({
        data: {
          tool: name,
          args: JSON.parse(toJson(parsed.data)),
          ok,
          result: text.slice(0, 2000),
          durationMs: Date.now() - started,
        },
      })
      .catch((error) => console.error('[mcp:bitacora]', error));
  }

  return { content: [{ type: 'text', text }], isError: !ok };
}

async function handleOne(
  tools: McpTool[],
  instructions: string,
  msg: RpcRequest,
): Promise<RpcResponse | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return fail(msg?.id, -32600, 'Solicitud JSON-RPC inválida.');
  }
  // Las notificaciones (sin id) no llevan respuesta.
  const isNotification = msg.id === undefined;

  switch (msg.method) {
    case 'initialize': {
      const pedida = String(msg.params?.protocolVersion ?? '');
      return {
        jsonrpc: '2.0',
        id: msg.id ?? null,
        result: {
          protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'taupoc-chile', title: 'TAUPOC Chile', version: '1.0.0' },
          instructions,
        },
      };
    }
    case 'ping':
      return isNotification ? null : { jsonrpc: '2.0', id: msg.id ?? null, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: msg.id ?? null,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: inputSchema(t.input),
            annotations: {
              title: t.title,
              readOnlyHint: Boolean(t.readOnly),
              destructiveHint: Boolean(t.destructive),
              openWorldHint: false,
            },
          })),
        },
      };
    case 'tools/call':
      return { jsonrpc: '2.0', id: msg.id ?? null, result: await callTool(tools, msg.params) };
    default:
      if (isNotification || msg.method.startsWith('notifications/')) return null;
      return fail(msg.id, -32601, `Método no soportado: ${msg.method}`);
  }
}

/** Procesa el cuerpo de un POST. `null` significa "202 sin cuerpo". */
export async function handleRpc(
  tools: McpTool[],
  instructions: string,
  body: unknown,
): Promise<RpcResponse | RpcResponse[] | null> {
  if (Array.isArray(body)) {
    const out: RpcResponse[] = [];
    for (const msg of body) {
      const res = await handleOne(tools, instructions, msg as RpcRequest);
      if (res) out.push(res);
    }
    return out.length ? out : null;
  }
  return handleOne(tools, instructions, body as RpcRequest);
}
