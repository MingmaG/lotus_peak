import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { McpOAuthClient, McpToken } from '@prisma/client';

import { db } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * OAuth 2.1 for AI clients.
 *
 * Not a second user system, which is the thing this must never become. A
 * token here belongs to a row in `users` — the same row the person signs into
 * the panel with — and what it may do is resolved from that row on every call.
 * This file answers one question, "which Lotus Peak person is this", and
 * everything downstream answers the rest.
 *
 * Tokens are opaque and stored hashed, not JWTs like the panel's own session.
 * A JWT would save a query per call and cost the one property that matters
 * most here: when the office disconnects an AI client at three o'clock, it
 * stops working at three o'clock.
 */

const ACCESS_TTL_MS = 60 * 60 * 1_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
/** Five minutes, per OAuth 2.1. A code is spent within seconds or never. */
const CODE_TTL_MS = 5 * 60 * 1_000;

/**
 * The scopes this server understands. Coarse on purpose.
 *
 * Scopes narrow and never widen. `mcp:write` is the right to *attempt* a
 * write, which is then checked against the person's own permissions; a token
 * with only `mcp:read` cannot write even if it belongs to the owner. The scope
 * is the client's declared intent, the permission is the company's decision,
 * and the narrower of the two wins.
 */
export const SUPPORTED_SCOPES = ['mcp:read', 'mcp:write'] as const;
export type McpScope = (typeof SUPPORTED_SCOPES)[number];

export class OAuthError extends Error {
  constructor(
    /** The RFC 6749 error code, which is what a client branches on. */
    readonly error: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('hex')}`;
}

/* -------------------------------------------------------------------------- */
/*  Where this server is                                                       */
/* -------------------------------------------------------------------------- */

/** The issuer, and the origin discovery advertises. */
export function issuerUrl(): string {
  return env.mcp.baseUrl;
}

/** The RFC 8707 resource identifier clients are told to ask for. */
export function mcpResourceUrl(): string {
  return `${env.mcp.baseUrl}/api/mcp`;
}

/**
 * Every address this same panel legitimately answers at.
 *
 * The advertised one alone is not enough. A development machine runs the
 * Claude app through a tunnel and Claude Code through localhost at the same
 * time, and accepting only the tunnel refuses the other with an
 * `invalid_target` that names neither address. RFC 8707 is there so a token minted
 * for a *different* server cannot be forwarded here; a second address of this
 * server does not weaken that.
 */
export function mcpResourceUrls(): string[] {
  const origins = [env.mcp.baseUrl, env.storage.adminPublicUrl, ...env.mcp.extraOrigins];
  return [...new Set(origins.filter(Boolean).map((origin) => `${origin}/api/mcp`))];
}

/** Fragments are dropped: RFC 8707 forbids one, and a client that sends one is
 *  otherwise refused for a reason it cannot see. */
export function isThisResource(resource: string): boolean {
  return mcpResourceUrls().includes(resource.replace(/#.*$/, '').replace(/\/$/, ''));
}

/* -------------------------------------------------------------------------- */
/*  Clients                                                                    */
/* -------------------------------------------------------------------------- */

export interface ClientRegistration {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
  client_uri?: string;
  software_id?: string;
}

/**
 * The redirect URIs a client may register.
 *
 * The redirect URI is where the authorization code is delivered, so a lax
 * rule here is how a code gets delivered somewhere else. Loopback is how a
 * desktop client (Claude Code, an IDE) finishes the flow, https is how a
 * hosted one does, and a private-use scheme with a dot in it is a native app.
 * Plain http anywhere else is refused.
 */
function acceptableRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:') {
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  }
  return /^[a-z][a-z0-9+.-]*\.[a-z0-9+.-]+:$/.test(url.protocol);
}

export async function registerClient(input: ClientRegistration) {
  const redirectUris = (input.redirect_uris ?? []).filter(Boolean);

  if (redirectUris.length === 0) {
    throw new OAuthError('invalid_redirect_uri', 'At least one redirect_uri is required.');
  }
  if (redirectUris.length > 10) {
    throw new OAuthError('invalid_redirect_uri', 'At most ten redirect URIs.');
  }
  for (const uri of redirectUris) {
    if (!acceptableRedirect(uri)) {
      throw new OAuthError('invalid_redirect_uri', `This redirect_uri is not acceptable: ${uri}`);
    }
  }

  const confidential =
    input.token_endpoint_auth_method === 'client_secret_post' ||
    input.token_endpoint_auth_method === 'client_secret_basic';
  const secret = confidential ? randomToken('lpmcp_cs') : null;

  const client = await db.mcpOAuthClient.create({
    data: {
      clientId: `lpmcp_${randomBytes(16).toString('hex')}`,
      name: (input.client_name || 'An unnamed AI client').slice(0, 120),
      secretHash: secret ? hashSecret(secret) : null,
      redirectUris,
      grantTypes: input.grant_types?.length
        ? input.grant_types
        : ['authorization_code', 'refresh_token'],
      scope: input.scope || SUPPORTED_SCOPES.join(' '),
      clientUri: input.client_uri?.slice(0, 500) ?? null,
      softwareId: input.software_id?.slice(0, 200) ?? null,
    },
  });

  return { client, secret };
}

export function getClient(clientId: string): Promise<McpOAuthClient | null> {
  return db.mcpOAuthClient.findUnique({ where: { clientId } });
}

/** Constant-time, so a wrong secret cannot be found a byte at a time. */
function secretMatches(provided: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(provided), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateClient(
  clientId: string,
  clientSecret: string | null,
): Promise<McpOAuthClient> {
  const client = await getClient(clientId);
  if (!client) throw new OAuthError('invalid_client', 'Unknown client.', 401);
  if (client.isBlocked) {
    throw new OAuthError('invalid_client', 'This AI client has been blocked by the office.', 401);
  }
  if (client.secretHash && (!clientSecret || !secretMatches(clientSecret, client.secretHash))) {
    throw new OAuthError('invalid_client', 'The client credentials are wrong.', 401);
  }
  return client;
}

/* -------------------------------------------------------------------------- */
/*  Codes and tokens                                                           */
/* -------------------------------------------------------------------------- */

export async function issueAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  resource: string | null;
}): Promise<string> {
  const code = randomToken('lpmcp_ac');
  await db.mcpAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      userId: input.userId,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: 'S256',
      resource: input.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * S256 only.
 *
 * `plain` is allowed by the specification and refused here: every client that
 * reaches this server can do S256, and accepting `plain` would make a leaked
 * authorization request a leaked token.
 */
function pkceMatches(verifier: string, challenge: string): boolean {
  return createHash('sha256').update(verifier).digest('base64url') === challenge;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface Meta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** A code for tokens. Single-use, PKCE-checked, bound to its redirect URI. */
export async function exchangeCode(
  args: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string | null;
  } & Meta,
): Promise<{ tokens: TokenResponse; userId: string }> {
  const row = await db.mcpAuthCode.findUnique({ where: { codeHash: hashSecret(args.code) } });

  if (!row) throw new OAuthError('invalid_grant', 'The authorization code is not recognised.');
  if (row.usedAt) {
    /* A code presented twice may have been stolen the first time, so what it
       produced is torn down rather than only the second attempt refused. */
    await db.mcpToken.updateMany({
      where: {
        userId: row.userId,
        clientId: row.clientId,
        createdAt: { gte: row.createdAt },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError('invalid_grant', 'This authorization code has already been used.');
  }
  if (row.expiresAt < new Date()) throw new OAuthError('invalid_grant', 'The code has expired.');
  if (row.clientId !== args.clientId) {
    throw new OAuthError('invalid_grant', 'The code was issued to a different client.');
  }
  if (row.redirectUri !== args.redirectUri) {
    throw new OAuthError('invalid_grant', 'redirect_uri does not match the authorization request.');
  }
  if (row.resource && args.resource && row.resource !== args.resource.replace(/\/$/, '')) {
    throw new OAuthError('invalid_target', 'resource does not match the authorization request.');
  }
  if (!pkceMatches(args.codeVerifier, row.codeChallenge)) {
    throw new OAuthError('invalid_grant', 'PKCE verification failed.');
  }

  /* Burnt by the statement that checks it is unburnt, so two requests racing
     with the same code produce one token, not two. */
  const burnt = await db.mcpAuthCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (burnt.count === 0) {
    throw new OAuthError('invalid_grant', 'This authorization code has already been used.');
  }

  const { tokens } = await mintTokens({
    userId: row.userId,
    clientId: row.clientId,
    scopes: row.scopes,
    resource: row.resource,
    familyId: randomBytes(16).toString('hex'),
    userAgent: args.userAgent,
    ipAddress: args.ipAddress,
  });
  return { tokens, userId: row.userId };
}

async function mintTokens(
  args: {
    userId: string;
    clientId: string;
    scopes: string[];
    resource: string | null;
    familyId: string;
  } & Meta,
): Promise<{ tokens: TokenResponse; id: string }> {
  const accessToken = randomToken('lpmcp_at');
  const refreshToken = randomToken('lpmcp_rt');
  const now = Date.now();

  const row = await db.mcpToken.create({
    data: {
      accessTokenHash: hashSecret(accessToken),
      refreshTokenHash: hashSecret(refreshToken),
      familyId: args.familyId,
      userId: args.userId,
      clientId: args.clientId,
      scopes: args.scopes,
      resource: args.resource,
      expiresAt: new Date(now + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      userAgent: args.userAgent?.slice(0, 500) ?? null,
      ipAddress: args.ipAddress ?? null,
    },
  });

  await db.mcpOAuthClient.update({
    where: { clientId: args.clientId },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: row.id,
    tokens: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TTL_MS / 1_000),
      refresh_token: refreshToken,
      scope: args.scopes.join(' '),
    },
  };
}

/**
 * Rotates a refresh token.
 *
 * The same reuse rule as a stolen session anywhere: a refresh token presented
 * after it was already exchanged means somebody else has a copy, so the whole
 * family dies and the person reconnects.
 *
 * The person is re-read here as well as on every call, so a deactivated
 * account or a switched-off AI access cannot be kept alive by refreshing.
 */
export async function refreshTokens(
  args: { refreshToken: string; clientId: string } & Meta,
): Promise<{ tokens: TokenResponse; userId: string }> {
  const row = await db.mcpToken.findUnique({
    where: { refreshTokenHash: hashSecret(args.refreshToken) },
  });

  if (!row) throw new OAuthError('invalid_grant', 'The refresh token is not recognised.');
  if (row.clientId !== args.clientId) {
    throw new OAuthError('invalid_grant', 'The refresh token belongs to a different client.');
  }
  if (row.rotatedToId) {
    await db.mcpToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError('invalid_grant', 'This refresh token was already used. Reconnect the client.');
  }
  if (row.revokedAt) throw new OAuthError('invalid_grant', 'This token has been revoked.');
  if (row.refreshExpiresAt && row.refreshExpiresAt < new Date()) {
    throw new OAuthError('invalid_grant', 'The refresh token has expired. Reconnect the client.');
  }

  const user = await db.user.findFirst({
    where: { id: row.userId, isActive: true, deletedAt: null },
    select: { mcpAccessEnabled: true },
  });
  if (!user) throw new OAuthError('invalid_grant', 'The account behind this token is no longer active.');
  if (!user.mcpAccessEnabled) {
    throw new OAuthError('invalid_grant', 'AI access has been switched off for this account.');
  }

  const minted = await mintTokens({
    userId: row.userId,
    clientId: row.clientId,
    scopes: row.scopes,
    resource: row.resource,
    familyId: row.familyId,
    userAgent: args.userAgent,
    ipAddress: args.ipAddress,
  });

  await db.mcpToken.update({
    where: { id: row.id },
    data: { rotatedToId: minted.id, revokedAt: new Date() },
  });

  return { tokens: minted.tokens, userId: row.userId };
}

/* -------------------------------------------------------------------------- */
/*  Verification                                                               */
/* -------------------------------------------------------------------------- */

export type TokenRejection =
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'CLIENT_BLOCKED'
  | 'USER_INACTIVE'
  | 'MCP_DISABLED'
  | 'WRONG_RESOURCE';

export type VerifyResult =
  | { ok: true; token: McpToken; client: McpOAuthClient }
  | { ok: false; reason: TokenRejection };

/**
 * A bearer token, checked on every single call.
 *
 * Everything is re-checked here rather than at issue: the token's expiry,
 * whether the client has since been blocked, whether the person is still
 * active, whether their AI access is still on. A token is a pointer to a
 * decision, and the decision can be withdrawn.
 */
export async function verifyAccessToken(raw: string): Promise<VerifyResult> {
  const token = await db.mcpToken.findUnique({
    where: { accessTokenHash: hashSecret(raw) },
    include: {
      client: true,
      user: { select: { isActive: true, deletedAt: true, mcpAccessEnabled: true } },
    },
  });

  if (!token) return { ok: false, reason: 'INVALID' };
  if (token.revokedAt) return { ok: false, reason: 'REVOKED' };
  if (token.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };
  if (token.client.isBlocked) return { ok: false, reason: 'CLIENT_BLOCKED' };
  if (!token.user.isActive || token.user.deletedAt) return { ok: false, reason: 'USER_INACTIVE' };
  if (!token.user.mcpAccessEnabled) return { ok: false, reason: 'MCP_DISABLED' };
  if (token.resource && !isThisResource(token.resource)) {
    return { ok: false, reason: 'WRONG_RESOURCE' };
  }

  /* Best effort: a failed touch must not fail the call. */
  void db.mcpToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { ok: true, token, client: token.client };
}

export async function revokeToken(raw: string): Promise<void> {
  const hash = hashSecret(raw);
  await db.mcpToken.updateMany({
    where: { OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }], revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** For the AI access screen: cut one person, or one client, off at once. */
export async function revokeTokensFor(filter: { userId?: string; clientId?: string }) {
  const { count } = await db.mcpToken.updateMany({
    where: { ...filter, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}
