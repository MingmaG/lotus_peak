import 'server-only';

import type { McpCallStatus, Prisma } from '@prisma/client';

import { db } from '@/lib/db';

export interface McpAuditInput {
  userId?: string | null;
  clientId?: string | null;
  clientLabel?: string | null;
  tool: string;
  arguments?: unknown;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  status: McpCallStatus;
  errorCode?: string | null;
  result?: unknown;
  approvalId?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  durationMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Keys whose values never belong in a log, however deeply nested.
 *
 * No tool takes a secret, but this log is the one place a mistake there
 * becomes permanent and searchable, so it is filtered on the way in rather
 * than trusted not to happen.
 */
const REDACT = /^(password|passwordHash|token|accessToken|refreshToken|secret|apiKey|authorization)$/i;

/**
 * A base64 photograph is a megabyte of evidence of nothing. Strings are cut,
 * long lists summarised: an audit row is a record, not a copy.
 */
const MAX_STRING = 2_000;

function sanitise(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 6) return '[deep]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}… (${value.length} characters)`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const head = value.slice(0, 50).map((item) => sanitise(item, depth + 1));
    return value.length > 50 ? [...head, `… ${value.length - 50} more`] : head;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT.test(key) ? '[redacted]' : sanitise(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * One line in AI clients → Activity.
 *
 * Never throws, for the reason `recordActivity`'s callers swallow its
 * failures: a write that succeeded must not be reported as failed because the
 * record of it could not be written.
 */
export async function logMcpCall(input: McpAuditInput): Promise<void> {
  try {
    await db.mcpAuditLog.create({
      data: {
        userId: input.userId ?? null,
        clientId: input.clientId ?? null,
        clientLabel: input.clientLabel ?? null,
        tool: input.tool,
        arguments: (sanitise(input.arguments) ?? undefined) as Prisma.InputJsonValue | undefined,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        status: input.status,
        errorCode: input.errorCode ?? null,
        result: (sanitise(input.result) ?? undefined) as Prisma.InputJsonValue | undefined,
        approvalId: input.approvalId ?? null,
        approvedById: input.approvedById ?? null,
        rejectedById: input.rejectedById ?? null,
        durationMs: input.durationMs ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error('[mcp] could not write the audit line', input.tool, error);
  }
}

/**
 * The connection itself — a token refused, a client registered, a consent.
 *
 * A refused token is the most interesting line in this log: it is either a
 * mistake or somebody trying. It is recorded even with nobody to pin it on.
 */
export function logMcpAuth(input: {
  event: 'client_registered' | 'consented' | 'token_rejected' | 'access_denied';
  userId?: string | null;
  clientId?: string | null;
  clientLabel?: string | null;
  reason?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  return logMcpCall({
    userId: input.userId,
    clientId: input.clientId,
    clientLabel: input.clientLabel,
    tool: `auth:${input.event}`,
    entityType: 'connection',
    status:
      input.event === 'client_registered' || input.event === 'consented' ? 'SUCCESS' : 'DENIED',
    errorCode: input.reason ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
