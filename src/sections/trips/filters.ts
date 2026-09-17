import type { TripType } from '@/content/types'

/**
 * Plain module, deliberately not 'use client': values exported from a client
 * module reach a server component as client references, not as the values
 * themselves, so `FILTERS.find` would not be a function on the server.
 */
export const FILTERS = ['All', 'Mindfulness', 'Meditation', 'Festival', 'Trekking'] as const

export type FilterLabel = (typeof FILTERS)[number]

export const TYPE_OF: Record<Exclude<FilterLabel, 'All'>, TripType> = {
  Mindfulness: 'mindfulness',
  Meditation: 'meditation',
  Festival: 'festival',
  Trekking: 'trekking',
}

export function toFilterLabel(value: string | undefined): FilterLabel {
  return FILTERS.find((f) => f === value) ?? 'All'
}
