import 'server-only';

import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { ApiError } from '@/lib/api/handler';
import { ForbiddenError } from '@/lib/auth/session';

/**
 * What an AI client gets back when something goes wrong.
 *
 * Small and stable on purpose. A model has to tell "you may not" from "a
 * person has not said yes yet" from "the record moved under you", because each
 * has a different sensible next step: it should not retry the first, and it
 * should not give up on the third. Nothing in here carries internals — no
 * stack, no SQL, no column names it did not send.
 */
export type McpErrorCode =
  | 'NOT_AUTHORIZED'
  | 'ENTITY_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_READY'
  | 'CONFLICT'
  | 'ENTITY_STATE_CHANGED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class McpToolError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
    /** Merged into the payload the client sees. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpToolError';
  }

  static notAuthorized(permission: string) {
    return new McpToolError(
      'NOT_AUTHORIZED',
      `Your Lotus Peak account does not hold "${permission}", so this cannot be done. ` +
        'Ask the owner to grant it — do not try another tool to get the same result.',
      { requiredPermission: permission },
    );
  }

  static notFound(what: string, id?: string) {
    return new McpToolError(
      'ENTITY_NOT_FOUND',
      `${what} could not be found. List or search again for the right id.`,
      id ? { id } : undefined,
    );
  }
}

/** The panel's own errors, in the vocabulary above. */
export function toMcpError(error: unknown): McpToolError {
  if (error instanceof McpToolError) return error;

  if (error instanceof ForbiddenError) return McpToolError.notAuthorized(error.permission);

  if (error instanceof ApiError) {
    const code: McpErrorCode =
      error.status === 404
        ? 'ENTITY_NOT_FOUND'
        : error.status === 403
          ? 'NOT_AUTHORIZED'
          : error.status === 409
            ? 'CONFLICT'
            : error.code === 'NOT_READY'
              ? 'NOT_READY'
              : error.status === 400 || error.status === 422
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR';
    return new McpToolError(
      code,
      error.message,
      error.details ? { fields: error.details } : undefined,
    );
  }

  if (error instanceof ZodError) {
    /* Field-keyed, as the panel's own forms get them, so a model can see
       which argument was wrong rather than guessing from one sentence. */
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_';
      if (!fields[path]) fields[path] = issue.message;
    }
    return new McpToolError('VALIDATION_ERROR', 'Some arguments need attention.', { fields });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return new McpToolError('CONFLICT', `Something already uses that ${target}.`);
    }
    if (error.code === 'P2025') return new McpToolError('ENTITY_NOT_FOUND', 'That no longer exists.');
    if (error.code === 'P2003') {
      return new McpToolError(
        'CONFLICT',
        'Something else still refers to this, or an id you sent does not exist.',
      );
    }
  }

  /* Logged in full for whoever runs the server and reported to the model as a
     blank, for the reason the REST API does it: an error message is a place
     internals leak from, and a model will repeat it to whoever is reading. */
  console.error('[mcp] unhandled tool error', error);
  return new McpToolError('INTERNAL_ERROR', 'Something went wrong on the Lotus Peak side.');
}
