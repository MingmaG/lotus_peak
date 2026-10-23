import 'server-only';

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';

import type { PreparedOperation, WriteTool } from './operation';

/**
 * Whether a particular call needs a person to say yes.
 *
 * Permission and approval are different questions. Permission asks "may this
 * person do this at all"; approval asks "does this action need somebody to
 * look first". Approval on every write makes the thing useless — fixing a meta
 * description would queue a card — and approval on none makes it dangerous.
 * So reads and edits to drafts go straight through, and anything that changes
 * what the public sees, what something costs, or whether a record exists,
 * waits.
 */

export const policySchema = z.object({
  /**
   * Every write waits, whatever its tool's default. The switch to reach for
   * while the office learns to trust it.
   */
  requireApprovalForAllWrites: z.boolean().default(false),
  /** How long a request stays approvable. */
  approvalTtlMinutes: z.number().int().min(5).max(7 * 24 * 60).default(24 * 60),
  /** Calls one person may make a minute, across all their clients. */
  rateLimitPerMinute: z.number().int().min(10).max(1_000).default(120),
});

export type AiPolicy = z.infer<typeof policySchema>;

const GROUP = 'ai';
const KEY = 'policy';

/**
 * From `Setting`, parsed on the way out like every Json column here: a policy
 * row somebody mangled by hand falls back to the defaults rather than taking
 * the endpoint down. The defaults are the cautious reading of every field.
 */
export async function getAiPolicy(): Promise<AiPolicy> {
  const row = await db.setting.findUnique({ where: { group_key: { group: GROUP, key: KEY } } });
  const parsed = policySchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : policySchema.parse({});
}

export async function saveAiPolicy(policy: AiPolicy): Promise<void> {
  const value = policySchema.parse(policy) as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({
    where: { group_key: { group: GROUP, key: KEY } },
    create: { group: GROUP, key: KEY, value },
    update: { value },
  });
}

export type ApprovalReason = 'critical' | 'global' | 'tool' | 'record';

/**
 * Four things can require approval, in this order: the tool is CRITICAL, the
 * office has switched every write to wait, the tool waits by default, or the
 * record is live. Each step can only add. The record comes last on purpose —
 * consulted earlier, a record that reported nothing could have *answered*
 * "no approval" for a call something above had already caught.
 *
 * A CRITICAL tool cannot be switched out of it by any setting. A policy that
 * can be loosened from inside the panel is one a prompt-injected AI with the
 * settings permission would loosen.
 */
export function approvalRequired(
  tool: WriteTool,
  policy: AiPolicy,
  prepared?: Pick<PreparedOperation, 'escalation'> | null,
): { required: boolean; reason?: ApprovalReason; escalation?: string } {
  if (tool.risk === 'CRITICAL') return { required: true, reason: 'critical' };
  if (policy.requireApprovalForAllWrites) return { required: true, reason: 'global' };
  if (tool.requiresApproval) return { required: true, reason: 'tool' };
  if (prepared?.escalation) {
    return { required: true, reason: 'record', escalation: prepared.escalation };
  }
  return { required: false };
}
