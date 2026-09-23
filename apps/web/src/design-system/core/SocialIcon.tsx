export type SocialPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'YOUTUBE'
  | 'X'
  | 'TIKTOK'
  | 'LINKEDIN'
  | 'PINTEREST'
  | 'TRIPADVISOR'
  | 'WHATSAPP'
  | 'THREADS'
  | 'OTHER'

/**
 * The footer's platform marks, as single-weight line drawings.
 *
 * Drawn in the same stroke as the rest of the site's linework rather than as
 * each platform's filled logo: eleven brand colours in a row would be the
 * loudest thing on a quiet page. Inline rather than an icon package, which
 * would be a dependency for eleven paths.
 *
 * `OTHER` is a globe, which is what the admin panel shows beside it too.
 */
const PATHS: Record<SocialPlatform, string[]> = {
  FACEBOOK: ['M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z'],
  INSTAGRAM: [
    'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z',
    'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z',
    'M17.5 6.5h.01',
  ],
  YOUTUBE: [
    'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
    'm10 15 5-3-5-3z',
  ],
  X: ['M4 4l11.733 16h4.267l-11.733-16z', 'M4 20l6.768-6.768', 'M13.228 10.772L20 4'],
  TIKTOK: [
    'M21 7.917v4.034a9.948 9.948 0 0 1-5-1.951v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z',
  ],
  LINKEDIN: [
    'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z',
    'M2 9h4v12H2z',
    'M6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ],
  PINTEREST: [
    'M8 20l4-9',
    'M10.7 14c.437 1.263 1.43 2 2.55 2 2.071 0 3.75-1.554 3.75-4a5 5 0 1 0-9.7 1.7',
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  ],
  TRIPADVISOR: [
    'M8 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    'M19 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    'M17.5 9a4.5 4.5 0 1 0 3.5 1.671l1-1.671h-4.5z',
    'M6.5 9a4.5 4.5 0 1 1-3.5 1.671l-1-1.671h4.5z',
    'M10.5 15.5l1.5 2 1.5-2',
    'M9 6.75c2-.667 4-.667 6 0',
  ],
  WHATSAPP: [
    'M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21',
    'M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1',
  ],
  THREADS: [
    'M19 7.5c-1.333-3-3.667-4.5-7-4.5-5 0-8 2.5-8 9s3.5 9 8 9 7-3 7-5-1-5-7-5c-2.5 0-3 1.25-3 2.5 0 1.5 1 2.5 2.5 2.5 2.5 0 3.5-1.5 3.5-5s-2-4-3-4-1.833.333-2.5 1',
  ],
  OTHER: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
}

export function SocialIcon({ platform, size = 20 }: { platform: SocialPlatform; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[platform].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
