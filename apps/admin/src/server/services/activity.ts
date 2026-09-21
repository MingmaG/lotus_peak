import 'server-only';

import { Prisma, type ActivityAction } from '@prisma/client';

import { db } from '@/lib/db';

export interface ActivityInput {
  userId: string | null;
  action: ActivityAction;
  entity: string;
  entityId?: string | null;
  /** What it was called at the time. */
  entityLabel?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  await db.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      /* `Prisma.DbNull` and not `null`: on a nullable Json column those mean
         different things, and `null` is a type error rather than a SQL NULL. */
      before: input.before ?? Prisma.DbNull,
      after: input.after ?? Prisma.DbNull,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/**
 * What changed, and nothing else.
 *
 * A full row snapshot of a journey with its itinerary is several kilobytes per
 * save, and the question this table answers is "what changed", not "what did
 * it look like". Thirty saves of a journey would otherwise be a quarter of a
 * megabyte of log to express that somebody fixed a typo in the excerpt.
 *
 * Keys present in one and absent in the other are reported: a field being
 * cleared is a change.
 */
export function diff<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const from: Partial<T> = before ?? {};
  const to: Partial<T> = after ?? {};
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of keys) {
    const a = from[key as keyof T];
    const b = to[key as keyof T];
    if (!equal(a, b)) {
      changedBefore[key] = truncate(a);
      changedAfter[key] = truncate(b);
    }
  }

  return { before: changedBefore, after: changedAfter };
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Long text becomes its first 200 characters and a note.
 *
 * An audit line for a journal entry should say that the body changed, not
 * carry a second copy of it. This is also what stops one paste of a long
 * article turning into a row that is slower to read than the article.
 */
function truncate(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 200) {
    return `${value.slice(0, 200)}… (${value.length} characters)`;
  }
  if (Array.isArray(value) && value.length > 20) {
    return `[${value.length} items]`;
  }
  return value ?? null;
}
