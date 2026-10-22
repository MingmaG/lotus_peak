import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { NextRequest } from 'next/server';

import {
  McpAuthError,
  authenticateMcpRequest,
  challengeHeader,
  type McpContext,
} from '@/server/mcp/context';
import { CORS_HEADERS, clientIp, jsonResponse, preflight } from '@/server/mcp/http';
import { buildMcpServer } from '@/server/mcp/server';

/**
 * The MCP endpoint — Streamable HTTP, at `/api/mcp`. See docs/AI-MCP.md.
 *
 * Stateless: a server is built per request and thrown away, there is no
 * session id, and everything durable is in Postgres. A stateless endpoint
 * behaves the same across a restart, which the approval flow — a request
 * now, a decision tomorrow — depends on.
 *
 * Nothing here trusts the body for identity. The caller is whoever the bearer
 * token says, read from `users` on every call.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** An upload fetched from an address can take a while. Nothing waits on a person. */
export const maxDuration = 60;

function unauthorized(error: McpAuthError): Response {
  return jsonResponse(
    { jsonrpc: '2.0', error: { code: -32001, message: error.message }, id: null },
    401,
    {
      /* Points the client at the metadata that starts the OAuth flow, which
         is how a cold connect works without anybody pasting a key. */
      'WWW-Authenticate': challengeHeader(
        error.reason === 'MISSING' ? 'invalid_request' : 'invalid_token',
        error.message,
      ),
    },
  );
}

async function handle(request: NextRequest, parsedBody?: unknown): Promise<Response> {
  let context: McpContext;
  let authInfo;
  try {
    ({ context, authInfo } = await authenticateMcpRequest(request.headers.get('authorization'), {
      ip: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    }));
  } catch (error) {
    if (error instanceof McpAuthError) return unauthorized(error);
    throw error;
  }

  const server = buildMcpServer(context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    /* JSON rather than SSE. Nothing here streams — a tool answers, or hands
       back an approval id — and plain JSON is the shape every client takes. */
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    const response = await transport.handleRequest(
      request as unknown as Request,
      parsedBody === undefined ? { authInfo } : { parsedBody, authInfo },
    );
    /* The transport owns its response, body and all, so the headers are
       added to it rather than the response being rebuilt around them. */
    for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
    return response;
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { jsonrpc: '2.0', error: { code: -32700, message: 'The body must be JSON.' }, id: null },
      400,
    );
  }
  return handle(request, body);
}

export function GET(request: NextRequest): Promise<Response> {
  return handle(request);
}

export function DELETE(request: NextRequest): Promise<Response> {
  return handle(request);
}

/* Answered without a token: a preflight never carries one, and requiring it
   would deadlock every browser client on its first call. */
export const OPTIONS = preflight;
