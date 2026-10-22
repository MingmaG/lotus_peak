import { jsonResponse, preflight } from '@/server/mcp/http';
import { SUPPORTED_SCOPES, issuerUrl, mcpResourceUrl } from '@/server/mcp/oauth';

/**
 * RFC 9728 — which authorization server issues tokens for `/api/mcp`.
 *
 * Served at `/.well-known/oauth-protected-resource` by a rewrite in
 * `next.config.ts`. It is the first thing a client fetches after its first
 * 401, and everything else follows from it.
 */

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return jsonResponse({
    resource: mcpResourceUrl(),
    authorization_servers: [issuerUrl()],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Lotus Peak admin',
  });
}

export const OPTIONS = preflight;
