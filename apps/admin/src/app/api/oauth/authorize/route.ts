import type { NextRequest } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { logMcpAuth } from '@/server/mcp/audit';
import { aiAccessFor, checkAuthorizeRequest } from '@/server/mcp/consent';
import { clientIp } from '@/server/mcp/http';
import { issueAuthorizationCode } from '@/server/mcp/oauth';

/**
 * The answer to the consent screen: allow, or deny.
 *
 * Behind the panel's sign-in like any other route, and posted by a form on the
 * panel's own page — the session cookie is `SameSite=Lax`, so a page on
 * another site cannot post this on somebody's behalf. Everything the form
 * carried is checked again: its hidden fields came back through the browser.
 */

export const dynamic = 'force-dynamic';

function back(redirectUri: string, params: Record<string, string | null>): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 303);
}

function plain(message: string, status = 400): Response {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const form = await request.formData();
  const get = (name: string) => form.get(name)?.toString() ?? null;

  const check = await checkAuthorizeRequest(get, { requireResponseType: false });
  if (!check.ok) {
    if (!check.redirectUri) return plain(check.problems.join('\n'));
    return back(check.redirectUri, {
      error: 'invalid_request',
      error_description: check.problems.join(' '),
      state: check.state,
    });
  }

  const { request: req, client } = check;

  if (get('decision') !== 'allow') {
    return back(req.redirectUri, {
      error: 'access_denied',
      error_description: 'The connection was declined.',
      state: req.state,
    });
  }

  const user = await currentUser();
  if (!user) {
    return back(req.redirectUri, {
      error: 'access_denied',
      error_description: 'The Lotus Peak sign-in expired before the connection was allowed.',
      state: req.state,
    });
  }

  const access = await aiAccessFor(user);
  if (!access.allowed) {
    await logMcpAuth({
      event: 'access_denied',
      userId: user.id,
      clientId: client.clientId,
      clientLabel: client.name,
      reason: 'CONSENT_REFUSED',
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    });
    return back(req.redirectUri, {
      error: 'access_denied',
      error_description: access.reason,
      state: req.state,
    });
  }

  const code = await issueAuthorizationCode({
    userId: user.id,
    clientId: client.clientId,
    redirectUri: req.redirectUri,
    scopes: req.scopes,
    codeChallenge: req.codeChallenge,
    resource: req.resource,
  });

  await logMcpAuth({
    event: 'consented',
    userId: user.id,
    clientId: client.clientId,
    clientLabel: client.name,
    reason: req.scopes.join(' '),
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return back(req.redirectUri, { code, state: req.state });
}
