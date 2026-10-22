import { jsonResponse, preflight } from '@/server/mcp/http';
import { SUPPORTED_SCOPES, issuerUrl } from '@/server/mcp/oauth';

/**
 * RFC 8414 — where to register, sign in and fetch tokens.
 *
 * `authorization_endpoint` is the consent *screen*, not an API route: it sits
 * behind the panel's own sign-in, which is the point. The person has already
 * proved who they are to this panel, so connecting an AI does not ask again
 * and there is no second user system to keep in step.
 */

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const issuer = issuerUrl();
  return jsonResponse({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
  });
}

export const OPTIONS = preflight;
