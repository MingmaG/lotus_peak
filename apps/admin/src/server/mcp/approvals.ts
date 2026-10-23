import 'server-only';

import type { McpApproval, Prisma } from '@prisma/client';

import { ApiError, conflict, notFound } from '@/lib/api/handler';
import { can, type Permission } from '@/lib/auth/permissions';
import type { CurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

import { logMcpCall } from './audit';
import type { Actor } from './context';
import { McpToolError, toMcpError } from './errors';
import type { PreparedOperation, WriteTool } from './operation';
import { getAiPolicy } from './policy';
import { writeTool } from './registry';

/**
 * The person in the loop.
 *
 * An AI asks, a person in the panel decides, and the panel does it. The model
 * is never told "approved" and never performs the write: the only path that
 * executes an approved operation is {@link approveApproval}, reached from a
 * request made by a signed-in person's browser. A model that a web page has
 * talked into something can file as many requests as it likes, and not one of
 * them does anything.
 */

export async function requestApproval(args: {
  actor: Actor;
  tool: WriteTool;
  input: unknown;
  prepared: PreparedOperation;
}): Promise<McpApproval> {
  const { actor, tool, input, prepared } = args;
  const policy = await getAiPolicy();

  return db.mcpApproval.create({
    data: {
      requestedById: actor.id,
      requestedVia: actor.clientLabel,
      toolName: tool.name,
      permission: tool.permission,
      risk: tool.risk,
      entityType: prepared.entityType,
      entityId: prepared.entityId,
      entityLabel: prepared.entityLabel,
      summary: prepared.summary,
      input: (input ?? {}) as Prisma.InputJsonValue,
      proposedChanges: prepared.proposedChanges as unknown as Prisma.InputJsonValue,
      preconditions: prepared.preconditions as unknown as Prisma.InputJsonValue,
      ipAddress: actor.ip,
      userAgent: actor.userAgent?.slice(0, 500) ?? null,
      expiresAt: new Date(Date.now() + policy.approvalTtlMinutes * 60_000),
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  What the client is told                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The envelope, whichever way a request ends.
 *
 * `status` says what happened to the *request*; what the operation produced is
 * nested under `result`. Spread instead, a journey's own `status`
 * ("PUBLISHED") would overwrite the request's ("completed"), and a model that
 * read `status` to decide what to tell a person would read the wrong one.
 */
export function outcomeFor(
  approval: McpApproval & {
    approvedBy?: { name: string } | null;
    rejectedBy?: { name: string } | null;
  },
): Record<string, unknown> {
  const base = {
    approvalId: approval.id,
    operation: approval.toolName,
    summary: approval.summary,
  };

  switch (approval.status) {
    case 'PENDING':
      return {
        success: false,
        status: 'approval_required',
        ...base,
        expiresAt: approval.expiresAt.toISOString(),
        message:
          'NOTHING HAS CHANGED YET. This needs a Lotus Peak administrator to approve it in ' +
          'the admin panel, under AI clients → Approvals. Tell the person that, and do not say it ' +
          'is done. Do not ask them to approve it in this conversation, and do not try ' +
          'another tool to get the same result. Call `approval_status` with this id later ' +
          'to find out how it ended.',
      };
    case 'EXECUTING':
      return {
        success: false,
        status: 'pending',
        ...base,
        message: 'Approved and being carried out now. Check again in a moment.',
      };
    case 'COMPLETED':
      return {
        success: true,
        status: 'completed',
        ...base,
        approvedBy: approval.approvedBy?.name ?? 'an administrator',
        approvedAt: approval.approvedAt?.toISOString() ?? null,
        result: (approval.result as Record<string, unknown> | null) ?? {},
      };
    case 'REJECTED':
      return {
        success: false,
        status: 'rejected',
        ...base,
        rejectedBy: approval.rejectedBy?.name ?? 'an administrator',
        reason: approval.rejectionReason ?? 'No reason was given.',
      };
    case 'EXPIRED':
      return {
        success: false,
        status: 'expired',
        ...base,
        message: 'Nobody acted on this before it expired. Nothing was changed.',
      };
    case 'FAILED':
      return {
        success: false,
        status: 'failed',
        ...base,
        errorCode: approval.errorCode ?? 'INTERNAL_ERROR',
        message: approval.errorMessage ?? 'The approved operation could not be carried out.',
      };
  }
}

/* -------------------------------------------------------------------------- */
/*  Approve                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Approves one request, and carries it out.
 *
 * Every step is load-bearing:
 *
 *  1. The approver holds `ai.publish` **and** whatever the operation needs.
 *     Being allowed to approve AI requests is not a way round the permission
 *     the request itself requires.
 *  2. The row is claimed by a conditional update that also checks expiry. Two
 *     people pressing Approve at once produce one write and one "already
 *     handled", never two publishes.
 *  3. The requester is re-read. The operation runs as them — their name on the
 *     activity log, their permissions checked — and somebody whose rights were
 *     taken away while the request sat in the queue does not get the write.
 *  4. The arguments are parsed again by the tool's own schema, and `execute`
 *     re-reads the record against `preconditions`. That is what stops an
 *     approval to publish one journey being spent after somebody archived it.
 */
export async function approveApproval(id: string, approver: CurrentUser) {
  if (!can(approver.permissions, 'ai.publish')) {
    throw new ApiError(403, 'FORBIDDEN', 'This account may not approve what an AI asks for.');
  }

  const existing = await db.mcpApproval.findUnique({ where: { id } });
  if (!existing) throw notFound('That request');

  if (!can(approver.permissions, existing.permission as Permission)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      `Approving this needs “${existing.permission}”, which your account does not hold.`,
    );
  }

  const claimed = await db.mcpApproval.updateMany({
    where: { id, status: 'PENDING', expiresAt: { gt: new Date() } },
    data: { status: 'EXECUTING', approvedById: approver.id, approvedAt: new Date() },
  });

  if (claimed.count === 0) {
    await expireStaleApprovals();
    const current = await db.mcpApproval.findUniqueOrThrow({ where: { id } });
    throw conflict(
      current.status === 'EXPIRED'
        ? 'This request expired before it was approved. Nothing was changed.'
        : `This request has already been handled (${current.status.toLowerCase()}).`,
    );
  }

  const approval = await db.mcpApproval.findUniqueOrThrow({ where: { id } });

  const requester = await db.user.findFirst({
    where: { id: approval.requestedById, isActive: true, deletedAt: null },
    include: { role: true },
  });

  if (!requester) {
    return fail(approval, approver, 'NOT_AUTHORIZED', 'The person who asked for this is no longer an active user.');
  }
  if (!requester.mcpAccessEnabled || !can(requester.role.permissions, 'ai.write')) {
    return fail(approval, approver, 'NOT_AUTHORIZED', `${requester.name} may no longer work through an AI client, so this was not carried out.`);
  }
  if (!can(requester.role.permissions, approval.permission as Permission)) {
    return fail(approval, approver, 'NOT_AUTHORIZED', `${requester.name} no longer holds “${approval.permission}”, so this was not carried out.`);
  }

  const actor: Actor = {
    id: requester.id,
    name: requester.name,
    email: requester.email,
    roleSlug: requester.role.slug,
    permissions: requester.role.permissions,
    clientId: null,
    clientLabel: approval.requestedVia,
    ip: approval.ipAddress,
    userAgent: approval.userAgent,
  };

  const startedAt = Date.now();

  try {
    const tool = writeTool(approval.toolName);
    if (!tool) {
      throw new McpToolError('INTERNAL_ERROR', `“${approval.toolName}” is no longer a tool on this server.`);
    }

    const input = tool.schema.parse(approval.input);
    const result = await tool.execute(
      input,
      {
        entityType: approval.entityType,
        entityId: approval.entityId,
        entityLabel: approval.entityLabel,
        summary: approval.summary,
        proposedChanges: approval.proposedChanges as never,
        preconditions: approval.preconditions as never,
      },
      actor,
    );

    const completed = await db.mcpApproval.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
        entityId: result.entityId ?? approval.entityId,
        entityLabel: result.entityLabel ?? approval.entityLabel,
        result: result.data as Prisma.InputJsonValue,
      },
    });

    await logMcpCall({
      userId: approval.requestedById,
      clientLabel: approval.requestedVia,
      tool: approval.toolName,
      arguments: approval.input,
      entityType: approval.entityType,
      entityId: completed.entityId,
      entityLabel: completed.entityLabel,
      status: 'SUCCESS',
      result: result.data,
      approvalId: approval.id,
      approvedById: approver.id,
      durationMs: Date.now() - startedAt,
    });

    return outcomeFor({ ...completed, approvedBy: { name: approver.name } });
  } catch (error) {
    const mcpError = toMcpError(error);
    return fail(approval, approver, mcpError.code, mcpError.message, Date.now() - startedAt);
  }
}

async function fail(
  approval: McpApproval,
  approver: CurrentUser,
  errorCode: string,
  errorMessage: string,
  durationMs?: number,
) {
  const failed = await db.mcpApproval.update({
    where: { id: approval.id },
    data: { status: 'FAILED', executedAt: new Date(), errorCode, errorMessage },
  });

  await logMcpCall({
    userId: approval.requestedById,
    clientLabel: approval.requestedVia,
    tool: approval.toolName,
    arguments: approval.input,
    entityType: approval.entityType,
    entityId: approval.entityId,
    entityLabel: approval.entityLabel,
    status: 'FAILED',
    errorCode,
    result: { message: errorMessage },
    approvalId: approval.id,
    approvedById: approver.id,
    durationMs: durationMs ?? null,
  });

  return outcomeFor({ ...failed, approvedBy: { name: approver.name } });
}

/* -------------------------------------------------------------------------- */
/*  Reject, expire, look up                                                    */
/* -------------------------------------------------------------------------- */

export async function rejectApproval(id: string, approver: CurrentUser, reason: string) {
  if (!can(approver.permissions, 'ai.publish')) {
    throw new ApiError(403, 'FORBIDDEN', 'This account may not decide what an AI asks for.');
  }

  const claimed = await db.mcpApproval.updateMany({
    where: { id, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      rejectedById: approver.id,
      rejectedAt: new Date(),
      rejectionReason: reason.trim() || null,
    },
  });

  if (claimed.count === 0) {
    const current = await db.mcpApproval.findUnique({ where: { id } });
    if (!current) throw notFound('That request');
    throw conflict(`This request has already been handled (${current.status.toLowerCase()}).`);
  }

  const approval = await db.mcpApproval.findUniqueOrThrow({ where: { id } });

  await logMcpCall({
    userId: approval.requestedById,
    clientLabel: approval.requestedVia,
    tool: approval.toolName,
    arguments: approval.input,
    entityType: approval.entityType,
    entityId: approval.entityId,
    entityLabel: approval.entityLabel,
    status: 'REJECTED',
    result: { reason },
    approvalId: approval.id,
    rejectedById: approver.id,
  });

  return outcomeFor({ ...approval, rejectedBy: { name: approver.name } });
}

/**
 * Marks everything that timed out.
 *
 * Called whenever the queue or a status is read, so an install with no cron
 * still answers correctly. An expired request nobody looked at is harmless;
 * one that silently stays approvable is not.
 */
export async function expireStaleApprovals(): Promise<number> {
  const { count } = await db.mcpApproval.updateMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return count;
}

/** One of the caller's own requests. Anybody else's is "not found". */
export async function getOwnApproval(id: string, userId: string) {
  await expireStaleApprovals();
  const approval = await db.mcpApproval.findUnique({
    where: { id },
    include: { approvedBy: { select: { name: true } }, rejectedBy: { select: { name: true } } },
  });
  if (!approval || approval.requestedById !== userId) {
    throw McpToolError.notFound('That approval request', id);
  }
  return approval;
}
