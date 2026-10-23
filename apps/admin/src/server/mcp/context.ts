import 'server-only';

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { can, type Permission } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

import { logMcpAuth } from './audit';
import { McpToolError } from './errors';
import { issuerUrl, verifyAccessToken, type TokenRejection } from './oauth';

/**
 * Who is calling, from the bearer token and nothing else.
 *
 * The rule this file exists for: **what a model says about itself is not
 * input.** A tool call carrying `{"role": "owner"}` has written two strings
 * into a JSON object; they fail schema validation and never reach a
 * permission check. The identity behind every decision is the one read here,
 * from a token this server issued to a person who signed into this panel.
 */

export interface Actor {
  id: string;
  name: string;
  email: string;
  roleSlug: string;
  permissions: string[];
  /** The client's registered name, "Claude" or "ChatGPT", for the record. */
  clientId: string | null;
  clientLabel: string;
  ip: string | null;
  userAgent: string | null;
}

export interface McpContext {
  actor: Actor;
  scopes: string[];
  tokenId: string;
}

const REJECTIONS: Record<TokenRejection, string> = {
  INVALID: 'The access token is not recognised.',
  EXPIRED: 'The access token has expired. Refresh it and try again.',
  REVOKED: 'This access token has been revoked.',
  CLIENT_BLOCKED: 'This AI client has been blocked by the Lotus Peak office.',
  USER_INACTIVE: 'The Lotus Peak account behind this token is no longer active.',
  MCP_DISABLED: 'AI access is switched off for this Lotus Peak account.',
  WRONG_RESOURCE: 'This token was issued for a different server.',
};

export class McpAuthError extends Error {
  constructor(
    readonly reason: TokenRejection | 'MISSING' | 'ROLE',
    message: string,
  ) {
    super(message);
    this.name = 'McpAuthError';
  }
}

/**
 * The header a caller with no token gets back.
 *
 * It is what makes a cold connect work: the client receives a 401 pointing at
 * the protected-resource metadata, follows it to the authorization server and
 * runs the OAuth flow, and nobody pastes a key anywhere.
 */
export function challengeHeader(error?: string, description?: string): string {
  const parts = [
    `Bearer resource_metadata="${issuerUrl()}/.well-known/oauth-protected-resource"`,
  ];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description.replace(/"/g, "'")}"`);
  return parts.join(', ');
}

/**
 * An `Authorization` header, turned into a context or refused.
 *
 * Throws rather than returning null, because the one correct response to a
 * failure here is a 401 with the challenge, and a nullable return is how that
 * gets forgotten.
 */
export async function authenticateMcpRequest(
  authorization: string | null,
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ context: McpContext; authInfo: AuthInfo }> {
  const raw = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!raw) throw new McpAuthError('MISSING', 'An access token is required.');

  const result = await verifyAccessToken(raw);
  if (!result.ok) {
    await logMcpAuth({
      event: 'token_rejected',
      reason: result.reason,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new McpAuthError(result.reason, REJECTIONS[result.reason]);
  }

  const { token, client } = result;
  const user = await db.user.findUniqueOrThrow({
    where: { id: token.userId },
    include: { role: true },
  });

  /**
   * The role is read here, not carried in the token.
   *
   * The panel's own session carries permissions in a fifteen-minute JWT and
   * lives with that lag. An AI token lasts an hour and acts without anybody
   * watching, so a role taken away at three o'clock is taken away from the
   * AI at three o'clock too.
   *
   * Two switches, both required: the role's `ai.write`, which says what a kind
   * of person may do, and the person's own `mcpAccessEnabled`, which
   * `verifyAccessToken` has already checked.
   */
  if (!can(user.role.permissions, 'ai.write')) {
    await logMcpAuth({
      event: 'access_denied',
      userId: user.id,
      clientId: client.clientId,
      clientLabel: client.name,
      reason: 'ROLE_LACKS_AI_WRITE',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new McpAuthError(
      'ROLE',
      `The "${user.role.name}" role may not work through an AI client. The owner can grant it on the Roles screen.`,
    );
  }

  const actor: Actor = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleSlug: user.role.slug,
    permissions: user.role.permissions,
    clientId: client.clientId,
    clientLabel: client.name,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };

  return {
    context: { actor, scopes: token.scopes, tokenId: token.id },
    authInfo: {
      token: raw,
      clientId: client.clientId,
      scopes: token.scopes,
      expiresAt: Math.floor(token.expiresAt.getTime() / 1_000),
    },
  };
}

/**
 * The authorisation decision for one call. Both halves must hold.
 *
 * The scope is what the client asked for when the person connected it; the
 * permission is what the company decided that person may do. Neither stands
 * in for the other, and the narrower wins.
 */
export function authorizeTool(context: McpContext, permission: Permission, readOnly: boolean) {
  const needed = readOnly ? 'mcp:read' : 'mcp:write';
  if (!context.scopes.includes(needed)) {
    throw new McpToolError(
      'NOT_AUTHORIZED',
      `This connection was granted ${context.scopes.join(', ') || 'nothing'}, and this needs ` +
        `"${needed}". Reconnect the AI client and allow it.`,
      { requiredScope: needed },
    );
  }
  if (!can(context.actor.permissions, permission)) {
    throw McpToolError.notAuthorized(permission);
  }
}
