import type { NextRequest } from 'next/server';

import { clientIp, jsonResponse, oauthErrorResponse, preflight, readParams } from '@/server/mcp/http';
import { OAuthError, authenticateClient, exchangeCode, refreshTokens } from '@/server/mcp/oauth';

/**
 * The token endpoint: a code for tokens, or a refresh token for new ones.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const params = await readParams(request);
    const meta = { userAgent: request.headers.get('user-agent'), ipAddress: clientIp(request) };

    /* client_secret_basic, for the confidential clients that use it. */
    let clientId = params.client_id;
    let clientSecret = params.client_secret ?? null;
    const basic = request.headers.get('authorization')?.match(/^Basic\s+(.+)$/i)?.[1];
    if (basic) {
      const [id, secret] = Buffer.from(basic, 'base64').toString().split(':');
      clientId = decodeURIComponent(id ?? '');
      clientSecret = decodeURIComponent(secret ?? '');
    }
    if (!clientId) throw new OAuthError('invalid_client', 'client_id is required.', 401);

    await authenticateClient(clientId, clientSecret);

    if (params.grant_type === 'authorization_code') {
      if (!params.code || !params.redirect_uri || !params.code_verifier) {
        throw new OAuthError('invalid_request', 'code, redirect_uri and code_verifier are required.');
      }
      const { tokens } = await exchangeCode({
        code: params.code,
        clientId,
        redirectUri: params.redirect_uri,
        codeVerifier: params.code_verifier,
        resource: params.resource ?? null,
        ...meta,
      });
      return jsonResponse(tokens);
    }

    if (params.grant_type === 'refresh_token') {
      if (!params.refresh_token) throw new OAuthError('invalid_request', 'refresh_token is required.');
      const { tokens } = await refreshTokens({ refreshToken: params.refresh_token, clientId, ...meta });
      return jsonResponse(tokens);
    }

    throw new OAuthError('unsupported_grant_type', 'Only authorization_code and refresh_token.');
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export const OPTIONS = preflight;
