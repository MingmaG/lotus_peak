import 'server-only'

import type { ApiEnvelope } from '@lotuspeak/api-contracts'

/**
 * The one place this application talks to the admin panel.
 *
 * Everything below `src/content/providers/api/` reads through here and nothing
 * else does. It is the same seam the file provider sat behind — `TRIPS` was a
 * module constant and it is a fetch now — so the swap touched this directory
 * and no component.
 *
 * ## Why a fetch and not a database query
 *
 * The admin panel owns the schema, the publishing rules and the media driver.
 * A second Prisma client here would mean two apps that have to be migrated
 * together and a website that *can* read a draft. Going through the API means
 * this site sees exactly what the admin panel decided to publish, in a shape
 * pinned by `@lotuspeak/api-contracts`, and holds no database credential.
 *
 * The cost is real and worth naming: **the admin panel has to be reachable
 * when this site builds.** `generateStaticParams` asks it for the journey
 * slugs, and a build against an unreachable API would otherwise produce a site
 * with no journeys rather than a build failure — which is why
 * {@link fetchContent} throws on anything but a 404.
 *
 * ## Caching
 *
 * Every read is tagged. The admin panel calls `/api/revalidate` on publish and
 * names the tags it touched, so publishing is a few hundred milliseconds
 * rather than a redeploy. `CONTENT_REVALIDATE_SECONDS` is the backstop for a
 * push that never arrived, not the publishing mechanism.
 */

export { REVALIDATE_TAGS as TAGS } from '@lotuspeak/api-contracts'
export type { RevalidateTag as ContentTag } from '@lotuspeak/api-contracts'

import { REVALIDATE_TAGS, type RevalidateTag } from '@lotuspeak/api-contracts'

function baseUrl(): string {
  const url = process.env.CONTENT_API_URL
  if (!url) {
    throw new Error(
      'CONTENT_API_URL is not set. This site reads its content from the admin ' +
        "panel's public API — see apps/web/.env.example.",
    )
  }
  return url.replace(/\/$/, '')
}

/**
 * How long a fetched payload may be served before it is refetched.
 *
 * An hour by default, and long on purpose: the admin panel pushes an
 * invalidation the moment anything is published, so this governs only the case
 * where that push was lost — a restart mid-publish, a network blip — and an
 * hour of staleness is a far better failure than a thundering herd every
 * minute.
 */
function revalidateSeconds(): number {
  const raw = Number(process.env.CONTENT_REVALIDATE_SECONDS)
  return Number.isFinite(raw) && raw > 0 ? raw : 3600
}

export class ContentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message)
    this.name = 'ContentError'
  }
}

interface FetchOptions {
  tags: readonly RevalidateTag[]
  query?: Record<string, string | number | boolean | undefined>
}

/**
 * Reads one resource, or throws.
 *
 * Throwing rather than returning null is deliberate for everything but a 404.
 * A build that silently produced a journeys index with nothing on it, because
 * the API was briefly down, is far worse than a build that stops — the empty
 * page would deploy, get crawled, and quietly drop five indexed pages.
 */
export async function fetchContent<T>(path: string, options: FetchOptions): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      next: { tags: [...options.tags], revalidate: revalidateSeconds() },
    })
  } catch (cause) {
    throw new ContentError(
      `Could not reach the content API at ${baseUrl()}. Is the admin panel running? ` +
        `(npm run dev:admin, or npm run dev from the repo root.)`,
      0,
      path,
    )
  }

  if (!response.ok) {
    throw new ContentError(
      `The content API answered ${response.status} for ${path}.`,
      response.status,
      path,
    )
  }

  const body = (await response.json()) as ApiEnvelope<T>
  return body.data
}

/**
 * Reads one resource, or returns null when it is not published.
 *
 * Only for the `bySlug` reads, where a 404 is the answer rather than a
 * failure: an unpublished journey has to produce `notFound()` on the page, not
 * a build error.
 */
export async function fetchContentOrNull<T>(
  path: string,
  options: FetchOptions,
): Promise<T | null> {
  try {
    return await fetchContent<T>(path, options)
  } catch (error) {
    if (error instanceof ContentError && error.status === 404) return null
    throw error
  }
}

export { REVALIDATE_TAGS }
