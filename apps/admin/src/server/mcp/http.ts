import 'server-only';

import { OAuthError } from './oauth';

/**
 * What the MCP and OAuth endpoints share at the HTTP edge.
 */

/**
 * CORS, because a browser-based MCP client is a real client.
 *
 * Claude and ChatGPT call these endpoints from their own servers and would
 * never notice their absence; a client running in a page fails its preflight
 * before the request is sent. `Expose-Headers` is the one that is easy to
 * miss: without it `fetch` hides `WWW-Authenticate` from the page, so a
 * browser client gets a bare 401, never finds the metadata, and never starts
 * the OAuth flow.
 *
 * A wildcard origin is safe here because nothing on these routes reads a
 * cookie — they are authenticated by bearer token or not at all.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

/** RFC 6749's error shape. A client branches on `error`, a person reads the rest. */
export function oauthErrorResponse(error: unknown): Response {
  if (error instanceof OAuthError) {
    return jsonResponse({ error: error.error, error_description: error.message }, error.status);
  }
  console.error('[oauth] unhandled', error);
  return jsonResponse({ error: 'server_error', error_description: 'Something went wrong.' }, 500);
}

/**
 * The caller's address, for the audit line and never for a decision.
 * `x-forwarded-for` is a list whose first entry is the client, and it is
 * trivially forged.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

/** Form or JSON, whichever the client sent. OAuth says form; some send JSON. */
export async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === 'string') as [string, string][],
    );
  }
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}
