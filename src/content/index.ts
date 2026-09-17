import { createFileProvider } from './providers/file'
import type { ContentRepository } from './repository'

export type ProviderName = 'file' | 'prisma' | 'payload' | 'sanity' | 'strapi'

let instance: ContentRepository | null = null

/**
 * The only way anything reaches content.
 *
 * Today there is one provider. When a database or CMS arrives, add its case
 * here with a dynamic import so an unused SDK never enters the bundle, and
 * nothing in app/ or src/sections/ changes.
 */
export function getContent(): ContentRepository {
  if (instance) return instance

  const source = (process.env.CONTENT_SOURCE ?? 'file') as ProviderName
  switch (source) {
    case 'file':
      instance = createFileProvider()
      break
    default:
      throw new Error(
        `CONTENT_SOURCE="${source}" is not implemented yet. ` +
          `See docs/specs/05-data-layer.md §5 for how to add a provider.`,
      )
  }

  return instance
}

export type { ContentRepository, EnquiryInput } from './repository'
export * from './types'
