import type { NextRequest } from 'next/server';

import { logMcpAuth } from '@/server/mcp/audit';
import { clientIp, jsonResponse, oauthErrorResponse, preflight } from '@/server/mcp/http';
import { OAuthError, registerClient, type ClientRegistration } from '@/server/mcp/oauth';

/**
 * RFC 7591 dynamic client registration.
 *
 * Open, as the protocol needs it to be: Claude and ChatGPT register themselves
 * on first connect, before anybody has signed in. Registering grants nothing.
 * A client is a name and some redirect addresses until a signed-in person
 * consents, and the office can block one from AI clients → Access.
 */

export const dynamic = 'force-dynamic';

/* Per address, in this process. Enough to stop a loop filling the table. */
const recent = new Map<string, number[]>();

export async function POST(request: NextRequest): Promise<Response> {
  const ip = clientIp(request) ?? 'unknown';
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < 60 * 60_000);
  if (hits.length >= 20) {
    return jsonResponse({ error: 'temporarily_unavailable', error_description: 'Too many registrations.' }, 429);
  }
  recent.set(ip, [...hits, now]);

  try {
    const body = (await request.json().catch(() => {
      throw new OAuthError('invalid_client_metadata', 'The body must be JSON.');
    })) as ClientRegistration;

    const { client, secret } = await registerClient(body);

    await logMcpAuth({
      event: 'client_registered',
      clientId: client.clientId,
      clientLabel: client.name,
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return jsonResponse(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: ['code'],
        scope: client.scope,
        token_endpoint_auth_method: secret ? 'client_secret_post' : 'none',
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      },
      201,
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export const OPTIONS = preflight;
