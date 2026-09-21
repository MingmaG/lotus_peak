import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';

import { ForbiddenError, currentUser, type CurrentUser } from '@/lib/auth/session';
import { can, type Permission } from '@/lib/auth/permissions';
import { recordActivity, type ActivityInput } from '@/server/services/activity';

/**
 * The wrapper every API route goes through.
 *
 * Four things that every handler would otherwise repeat, and that a handler
 * written in a hurry would omit:
 *
 * 1. **The permission check.** Declared beside the route, not buried in it.
 * 2. **Body validation.** A Zod schema, parsed before the handler runs, so the
 *    handler's argument is typed and cannot be a lie.
 * 3. **Error translation.** A Prisma unique-constraint violation becomes a 409
 *    naming the field, not a 500 with a stack trace.
 * 4. **The audit line.** Written here rather than by each handler, so a route
 *    that forgets to log cannot exist.
 *
 * The last is the reason this exists at all. `drokpo`'s equivalent grew the
 * audit log later, and adding it meant finding every write in ninety route
 * files and hoping.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'That') =>
  new ApiError(404, 'NOT_FOUND', `${what} could not be found.`);

export const conflict = (message: string) =>
  new ApiError(409, 'CONFLICT', message);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export interface HandlerContext<TBody, TParams> {
  request: NextRequest;
  user: CurrentUser;
  body: TBody;
  params: TParams;
  searchParams: URLSearchParams;
  /**
   * Records what this request changed.
   *
   * Called by the handler because only the handler knows what the row was
   * called and which fields moved. Not calling it on a write is caught in
   * review by the absence of the line, which is easier to see than a missing
   * `await log(...)` three files away.
   */
  audit: (input: Omit<ActivityInput, 'userId' | 'ipAddress' | 'userAgent'>) => void;
}

export interface RouteOptions<TBody, TParams> {
  /** Null means "any signed-in person", which is right for a few read routes. */
  permission: Permission | null;
  /**
   * `ZodType<TBody, ZodTypeDef, unknown>`, not `ZodSchema<TBody>`.
   *
   * `ZodSchema<T>` pins the schema's *input* type to `T` as well as its
   * output, which makes every schema with a `.default()` on it unassignable —
   * its input has the field optional and its output does not. Leaving the
   * input as `unknown` is also the truth: the input is a parsed JSON body.
   */
  schema?: ZodType<TBody, ZodTypeDef, unknown>;
  handler: (context: HandlerContext<TBody, TParams>) => Promise<unknown>;
}

/**
 * What Next hands a route handler as its second argument.
 *
 * Not optional, even on a route with no dynamic segment: Next's generated
 * `.next/types` declares the parameter as required and a handler typed with
 * `args?:` fails `next build` with a `ParamCheck<RouteContext>` mismatch that
 * names neither the route nor the optionality.
 */
type NextRouteArgs<TParams> = { params: Promise<TParams> };

export function route<TBody = undefined, TParams = Record<string, string>>(
  options: RouteOptions<TBody, TParams>,
) {
  return async (request: NextRequest, args: NextRouteArgs<TParams>) => {
    const pending: ActivityInput[] = [];

    try {
      const user = await currentUser();
      if (!user) {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      }
      if (options.permission && !can(user.permissions, options.permission)) {
        throw new ForbiddenError(options.permission);
      }

      let body = undefined as TBody;
      if (options.schema) {
        const raw = await readJson(request);
        body = options.schema.parse(raw);
      }

      const params = ((await args?.params) ?? {}) as TParams;


      const result = await options.handler({
        request,
        user,
        body,
        params,
        searchParams: request.nextUrl.searchParams,
        audit: (input) => {
          pending.push({
            ...input,
            userId: user.id,
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
            userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
          });
        },
      });

      /**
       * The audit lines are written after the handler returns, not inside it.
       *
       * A log line for a write that then failed is a log line that is wrong,
       * and a write that succeeded with an audit line that failed should still
       * be a write — so these are fired and their failures swallowed, with the
       * reason recorded.
       */
      for (const entry of pending) {
        void recordActivity(entry).catch((error) => {
          console.error('[activity] could not record', entry.entity, error);
        });
      }

      if (result === undefined || result === null) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(result);
    } catch (error) {
      return toResponse(error);
    }
  };
}

async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('The request body was not valid JSON.');
  }
}

function toResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: error.message,
          details: { permission: error.permission },
        },
      },
      { status: 403 },
    );
  }

  if (error instanceof ZodError) {
    /**
     * Field-keyed, because the form needs to put each message beside its
     * input. A flat array of messages leaves the client guessing which field
     * "Required" refers to.
     */
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_';
      if (!fields[path]) fields[path] = issue.message;
    }
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields need attention.',
          details: fields,
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Something already uses that ${target}.`,
            details: { target },
          },
        },
        { status: 409 },
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That no longer exists.' } },
        { status: 404 },
      );
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        {
          error: {
            code: 'IN_USE',
            message: 'Something else still refers to this, so it cannot be deleted.',
          },
        },
        { status: 409 },
      );
    }
  }

  console.error('[api] unhandled', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } },
    { status: 500 },
  );
}

/* -------------------------------------------------------------------------- */
/*  List queries                                                               */
/* -------------------------------------------------------------------------- */

export interface ListQuery {
  page: number;
  perPage: number;
  search: string;
  sort: string;
  direction: 'asc' | 'desc';
  status: string | null;
}

/**
 * The query every list screen sends.
 *
 * `perPage` is capped at 100. Uncapped, a `?perPage=100000` on the enquiries
 * table is a full export of everybody's personal data through a read endpoint,
 * which is not a thing a pagination parameter should be able to do.
 */
export function listQuery(searchParams: URLSearchParams): ListQuery {
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 25));
  return {
    page,
    perPage,
    search: (searchParams.get('q') ?? '').trim(),
    sort: searchParams.get('sort') ?? 'updatedAt',
    direction: searchParams.get('direction') === 'asc' ? 'asc' : 'desc',
    status: searchParams.get('status'),
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(
  items: T[],
  total: number,
  query: ListQuery,
): Paginated<T> {
  return {
    items,
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}
