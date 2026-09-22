import 'server-only';

import { NextResponse } from 'next/server';
import type { ApiEnvelope } from '@lotuspeak/api-contracts';

/**
 * The public API's answers.
 *
 * Separate from `lib/api/handler` because everything in there begins by
 * requiring a signed-in user, and these endpoints have none: they serve the
 * website, they carry no credential, and they return only published rows.
 *
 * ## Caching
 *
 * `no-store` on every one of them, which looks wrong until you see where the
 * caching actually is. The *website* caches these responses, tagged, for an
 * hour, and drops the tags when the admin panel tells it to. A second cache
 * here would be a second thing to invalidate, and the failure it produces —
 * publishing works, the site updates, and then reverts a minute later when a
 * stale upstream entry is served — is the worst kind to diagnose.
 */
export function ok<T>(data: T): NextResponse {
  const body: ApiEnvelope<T> = { data, generatedAt: new Date().toISOString() };
  return NextResponse.json(body, {
    headers: { 'cache-control': 'no-store' },
  });
}

export function missing(what: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: `No ${what} by that name is published.` } },
    { status: 404, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Turns an unexpected failure into a 500 with nothing in it.
 *
 * The website throws on anything but a 404, deliberately, so that a build
 * against a broken API stops rather than deploying a journeys index with
 * nothing on it. What it must not do is put this application's stack trace on
 * a public endpoint.
 */
export function failed(error: unknown, path: string): NextResponse {
  console.error(`[public-api] ${path}`, error);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'The content API could not answer.' } },
    { status: 500, headers: { 'cache-control': 'no-store' } },
  );
}

/** Wraps a handler so no public route can leak a stack trace. */
export function publicRoute<TArgs extends unknown[]>(
  path: string,
  handler: (...args: TArgs) => Promise<NextResponse>,
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return failed(error, path);
    }
  };
}
