import 'server-only';

import type { McpRisk } from '@prisma/client';
import type { z } from 'zod';

import type { Permission } from '@/lib/auth/permissions';

import type { Actor } from './context';
import { McpToolError } from './errors';

/**
 * What a tool is, declared once.
 *
 * Everything the server, the approval queue, the policy screen and `whoami`
 * need to know about a tool lives on its definition, beside the code that
 * runs it — so adding one is one object in one file, and there is no second
 * list of names to forget to update.
 *
 * Schemas are `ZodObject`s with no `.refine()` on the outside. The SDK
 * publishes an object's shape as JSON Schema; a refined object is a
 * `ZodEffects`, which it publishes as an empty schema, and the model then
 * calls the tool with nothing.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = z.ZodObject<any>;

interface ToolBase<S extends AnyObject> {
  name: string;
  title: string;
  /**
   * What a model reads to decide whether this is the tool. The first sentence
   * should stand on its own; the rest says what it will not do and what to
   * use instead.
   */
  description: string;
  /** From the panel's own catalogue. There is no second list for the AI. */
  permission: Permission;
  /** `trip`, `post`, `page` — the noun the activity log already uses. */
  entityType: string;
  schema: S;
}

export interface ReadTool<S extends AnyObject = AnyObject> extends ToolBase<S> {
  kind: 'read';
  run(input: z.infer<S>, actor: Actor): Promise<unknown>;
}

export interface WriteTool<S extends AnyObject = AnyObject> extends ToolBase<S> {
  kind: 'write';
  risk: McpRisk;
  /**
   * Whether this tool, by itself, waits for a person.
   *
   * A fact about the tool, decided before anybody knows which record is being
   * edited. What is true of the *record* — that it is live on the website —
   * is `PreparedOperation.escalation`, and can only add to this.
   */
  requiresApproval: boolean;
  prepare(input: z.infer<S>, actor: Actor): Promise<PreparedOperation>;
  execute(input: z.infer<S>, prepared: PreparedOperation, actor: Actor): Promise<OperationResult>;
}

export type ToolDefinition = ReadTool | WriteTool;

export function defineRead<S extends AnyObject>(tool: Omit<ReadTool<S>, 'kind'>): ReadTool {
  return { ...tool, kind: 'read' } as unknown as ReadTool;
}

export function defineWrite<S extends AnyObject>(tool: Omit<WriteTool<S>, 'kind'>): WriteTool {
  return { ...tool, kind: 'write' } as unknown as WriteTool;
}

/* -------------------------------------------------------------------------- */
/*  A write, described once and run down two paths                             */
/* -------------------------------------------------------------------------- */

/**
 * The tool handler never knows whether its write will run now or in an hour
 * after somebody presses Approve: it calls `prepare`, and the policy decides.
 * That is deliberate. When "run it" and "queue it" are two pieces of code, the
 * queued one is the one that drifts, and a queued publish is exactly the call
 * that cannot afford to have drifted.
 *
 * `prepare` reads the world and says what would change. `execute` reads it
 * *again* and does it. The gap between them is where somebody else edits the
 * record, so nothing `prepare` learned is trusted by `execute` beyond what was
 * written into `preconditions`.
 */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

export interface PreparedOperation {
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  /** One sentence naming the operation — the approval card's heading. */
  summary: string;
  /** Field by field, before and after. What the person deciding reads. */
  proposedChanges: Record<string, FieldChange>;
  /**
   * The facts the operation depends on, as they were when it was asked for:
   * the record's `updatedAt`, the status it is moving away from. Compared
   * verbatim before the write. Not the whole record.
   */
  preconditions: Record<string, unknown>;
  /**
   * Why this particular call waits for a person when its tool normally would
   * not — one sentence, shown on the card.
   *
   * Rewriting the overview of a draft nobody can reach is housekeeping;
   * rewriting the overview of a journey travellers are reading is changing a
   * sales page. Same tool, same field, different answer, and only `prepare`
   * has the record in hand to say so. It only ever tightens.
   */
  escalation?: string | null;
}

export interface OperationResult {
  entityId: string | null;
  entityLabel: string | null;
  /** What the client receives under `result`. */
  data: Record<string, unknown>;
}

/**
 * Refuses to go on if the world moved.
 *
 * Approval to publish a journey that was a draft is not approval to publish
 * one somebody has since archived, and it is certainly not approval to write
 * over an edit made in between.
 */
export function assertUnchanged(
  preconditions: Record<string, unknown>,
  current: Record<string, unknown>,
): void {
  const moved: { field: string; was: unknown; now: unknown }[] = [];
  for (const [field, expected] of Object.entries(preconditions)) {
    const actual = current[field] ?? null;
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      moved.push({ field, was: expected, now: actual });
    }
  }
  if (moved.length > 0) {
    throw new McpToolError(
      'ENTITY_STATE_CHANGED',
      'This record changed after the request was made, so nothing was done. Read it again ' +
        'and send a new request if the change still makes sense.',
      { changedSinceRequest: moved },
    );
  }
}

/** `updatedAt` as a precondition: the cheap optimistic lock. */
export function stamp(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * The reason a write to a live record waits, or null when it does not.
 *
 * A published journey is a page travellers are reading and search engines
 * have indexed. Drafts, scheduled and archived rows go straight through:
 * nothing anybody can reach changes.
 */
export function liveRecordEscalation(
  record: { status: string } | null | undefined,
  noun: string,
): string | null {
  if (record?.status !== 'PUBLISHED') return null;
  /* The label is already in the summary this is appended to; repeating it
     made every card name the journey twice. */
  return `the ${noun} is published, so this changes a page the public can already read.`;
}

/**
 * Before and after for the fields a patch names, and nothing else.
 *
 * A field sent with the value it already has is left out, so the card shows
 * what would move rather than what was mentioned.
 */
export function changesFrom(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const [field, to] of Object.entries(patch)) {
    if (to === undefined) continue;
    const from = current[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
}

export function nothingToChange(): never {
  throw new McpToolError(
    'VALIDATION_ERROR',
    'Nothing would change: every field sent already has that value, or none was sent.',
  );
}
