import 'server-only';

import { z } from 'zod';

import { McpToolError } from './errors';

/**
 * Editing one row of a list without replacing the rest.
 *
 * `updateTrip` replaces a list wholesale when it is present, which is right
 * for the editor: the form always holds every row on screen. A model does not
 * work that way. It reads eleven FAQs, rewrites one and sends that one — which
 * under replace semantics deletes ten and reports success. So every list a
 * tool takes comes with a `mode`, defaulting to `patch`, and this file turns
 * that into the whole list the service expects.
 *
 * Rows are addressed by 1-based `index` — their position in the most recent
 * read. Not by id: a journey's child rows are recreated on every save, so an
 * id is only good against the read that produced it, and a position is what
 * the person in the conversation means by "the third day" anyway.
 */

export const listModeSchema = z
  .enum(['patch', 'append', 'remove', 'replace'])
  .default('patch')
  .describe(
    '`patch` (default): change only the rows you send, each naming its 1-based `index` from your ' +
      'last read; everything else stays. `append`: add rows at the end. `remove`: delete the rows ' +
      'whose `index` you send. `replace`: the list becomes exactly what you send — only when the ' +
      'whole list really is being rewritten.',
  );

export type ListMode = z.infer<typeof listModeSchema>;

export const rowIndex = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe('1-based position in the list as you last read it. Required for patch and remove.');

/**
 * Merges `rows` into `current` according to `mode`.
 *
 * `toFull` builds a complete row from a partial one laid over the existing
 * row (patch) or over nothing (append, replace); it is where a missing
 * required field is caught, with the row's position in the message.
 */
export function mergeList<Current, Incoming extends { index?: number }>(args: {
  noun: string;
  current: Current[];
  rows: Incoming[];
  mode: ListMode;
  toFull: (incoming: Omit<Incoming, 'index'>, existing: Current | null) => Current;
  max: number;
}): Current[] {
  const { noun, current, rows, mode, toFull, max } = args;
  const strip = ({ index: _index, ...rest }: Incoming) => rest as Omit<Incoming, 'index'>;

  let next: Current[];

  switch (mode) {
    case 'replace':
      next = rows.map((row) => toFull(strip(row), null));
      break;

    case 'append':
      next = [...current, ...rows.map((row) => toFull(strip(row), null))];
      break;

    case 'remove': {
      const doomed = new Set(rows.map((row) => position(noun, row.index, current.length)));
      next = current.filter((_, i) => !doomed.has(i));
      break;
    }

    case 'patch': {
      next = [...current];
      for (const row of rows) {
        const i = position(noun, row.index, current.length);
        next[i] = toFull(strip(row), current[i]!);
      }
      break;
    }
  }

  if (next.length > max) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `That would leave ${next.length} ${noun}s; a journey takes at most ${max}.`,
    );
  }
  return next;
}

function position(noun: string, index: number | undefined, length: number): number {
  if (index === undefined) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `Each ${noun} in a patch or remove needs its 1-based \`index\`. To add one, use mode "append".`,
    );
  }
  if (index < 1 || index > length) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `There is no ${noun} ${index}: the list has ${length}. Read it again — positions may have moved.`,
    );
  }
  return index - 1;
}

/** "Required" for a field a new row must have, naming the row. */
export function need<T>(value: T | undefined | null, field: string, noun: string): T {
  if (value === undefined || value === null || value === '') {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `A new ${noun} needs \`${field}\`. To change an existing one, use mode "patch" with its index.`,
    );
  }
  return value;
}
