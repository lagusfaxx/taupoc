import { handleMcpPost, mcpMethodNotAllowed } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

/** Servidor MCP. El token va en `Authorization: Bearer <MCP_TOKEN>`. */
export async function POST(request: Request) {
  return handleMcpPost(request);
}

export const GET = mcpMethodNotAllowed;
export const DELETE = mcpMethodNotAllowed;
