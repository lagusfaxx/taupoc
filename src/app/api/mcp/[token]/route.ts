import { handleMcpPost, mcpMethodNotAllowed } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

/**
 * Servidor MCP con el token en la URL, para clientes que no permiten fijar
 * cabeceras (los conectores personalizados de claude.ai).
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleMcpPost(request, token);
}

export const GET = mcpMethodNotAllowed;
export const DELETE = mcpMethodNotAllowed;
