import { createApiProvider } from './providers/api'
import { createFileProvider } from './providers/file'
import type { ContentRepository } from './repository'

export type ProviderName = 'api' | 'file'

let instance: ContentRepository | null = null

/**
 * The only way anything reaches content.
 *
 * `api` is the default and is what a real install uses: the admin panel's
 * public API, which serves published rows only and which the office edits.
 *
 * `file` is kept, and kept working. It is the fixture a new provider is
 * checked against, it is what makes this directory buildable without the
 * admin panel running, and it is the reason the cutover to `api` touched six
 * files and no component. A change that breaks it is a change that has
 * quietly coupled a page to a provider.
 */
export function getContent(): ContentRepository {
  if (instance) return instance

  const source = (process.env.CONTENT_SOURCE ?? 'api') as ProviderName
  switch (source) {
    case 'api':
      instance = createApiProvider()
      break
    case 'file':
      instance = createFileProvider()
      break
    default:
      throw new Error(
        `CONTENT_SOURCE="${source}" is not a provider. Use "api" or "file"; ` +
          `see docs/specs/05-data-layer.md §5 for how to add another.`,
      )
  }

  return instance
}

export type { ContentRepository, EnquiryInput } from './repository'
export * from './types'
