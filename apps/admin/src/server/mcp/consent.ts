import 'server-only';

import type { McpOAuthClient } from '@prisma/client';

import { can } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

import { SUPPORTED_SCOPES, getClient, isThisResource, mcpResourceUrl, mcpResourceUrls } from './oauth';

/**
 * An authorization request, checked once for the screen and once for the
 * POST that answers it.
 *
 * The same function both times, because the POST must not trust anything the
 * screen decided: the form's hidden fields came back through the browser and
 * can say anything.
 */

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  state: string | null;
  scopes: string[];
  codeChallenge: string;
  resource: string;
}

export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest; client: McpOAuthClient }
  | {
      ok: false;
      problems: string[];
      /** Set when the redirect is the client's own, so an error can go back to it. */
      redirectUri: string | null;
      state: string | null;
    };

export async function checkAuthorizeRequest(
  get: (name: string) => string | null | undefined,
  /** The screen shows a GET; the POST answers it. Only the screen needs `response_type`. */
  options: { requireResponseType: boolean },
): Promise<AuthorizeCheck> {
  const clientId = get('client_id') ?? '';
  const redirectUri = get('redirect_uri') ?? '';
  const state = get('state') ?? null;
  const codeChallenge = get('code_challenge') ?? '';
  const method = get('code_challenge_method') ?? 'S256';
  const resource = (get('resource') || mcpResourceUrl()).replace(/\/$/, '');
  const scopes = (get('scope') || SUPPORTED_SCOPES.join(' ')).split(/\s+/).filter(Boolean);

  const problems: string[] = [];
  const client = clientId ? await getClient(clientId) : null;

  if (!clientId) problems.push('The AI client did not say who it is (no client_id).');
  else if (!client) problems.push('This AI client is not registered with Lotus Peak.');
  else if (client.isBlocked) problems.push('This AI client has been blocked by the office.');

  /* Only a registered redirect may receive an error, never mind a code —
     otherwise this screen is a way to bounce a browser anywhere. */
  const verifiedRedirect = client && client.redirectUris.includes(redirectUri) ? redirectUri : null;
  if (!redirectUri) problems.push('No redirect address was given.');
  else if (client && !verifiedRedirect) problems.push('The redirect address is not one this client registered.');

  if (options.requireResponseType && get('response_type') !== 'code') {
    problems.push('Only the authorization-code flow is supported.');
  }
  if (!codeChallenge) problems.push('The client sent no PKCE challenge.');
  if (method !== 'S256') problems.push('Only the S256 PKCE method is accepted.');

  const unknown = scopes.filter((scope) => !SUPPORTED_SCOPES.includes(scope as never));
  if (unknown.length) problems.push(`Unknown scope: ${unknown.join(', ')}.`);
  if (scopes.length === 0) problems.push('No scope was asked for.');

  if (!isThisResource(resource)) {
    problems.push(`The client asked for a different server. This one is ${mcpResourceUrls().join(' or ')}.`);
  }

  if (problems.length > 0 || !client) {
    return { ok: false, problems, redirectUri: verifiedRedirect, state };
  }
  return {
    ok: true,
    client,
    request: { clientId, redirectUri, state, scopes, codeChallenge, resource },
  };
}

/** Whether this person may connect an AI at all, and if not, why — in words. */
export async function aiAccessFor(user: { id: string; permissions: string[] }) {
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { mcpAccessEnabled: true, role: { select: { name: true, permissions: true } } },
  });
  /* The role is read from the row rather than the access token, which can be
     fifteen minutes behind a change on the Roles screen. */
  const roleAllows = can(row?.role.permissions, 'ai.write');
  const switchedOn = Boolean(row?.mcpAccessEnabled);
  return {
    allowed: roleAllows && switchedOn,
    roleName: row?.role.name ?? 'Unknown',
    reason: !roleAllows
      ? `The ${row?.role.name ?? ''} role may not work through an AI client. The owner can grant “AI clients → Change” on the Roles screen.`
      : !switchedOn
        ? 'AI access is switched off for your account. Somebody who can manage AI clients can switch it on under AI clients → Access.'
        : null,
  };
}
