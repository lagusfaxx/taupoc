import 'server-only';
import { NextResponse } from 'next/server';
import { bearer, checkToken, handleRpc } from './protocol';
import { INSTRUCTIONS, TOOLS } from './tools';

/**
 * Atiende `/api/mcp` y `/api/mcp/<token>`. Las dos rutas comparten todo:
 * solo cambia de dónde sale el token.
 */
export async function handleMcpPost(request: Request, pathToken?: string) {
  const auth = checkToken(bearer(request.headers.get('authorization')) ?? pathToken);
  if (auth === 'disabled') {
    return NextResponse.json(
      { error: 'El servidor MCP está desactivado. Define MCP_TOKEN (mínimo 24 caracteres) para activarlo.' },
      { status: 503 },
    );
  }
  if (auth === 'denied') {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'El cuerpo no es JSON válido.' } },
      { status: 400 },
    );
  }

  const response = await handleRpc(TOOLS, INSTRUCTIONS, body);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}

/** Sin sesiones ni flujo SSE: el GET y el DELETE del transporte no aplican. */
export function mcpMethodNotAllowed() {
  return NextResponse.json({ error: 'Usa POST con JSON-RPC.' }, { status: 405, headers: { Allow: 'POST' } });
}
