import type { NextConfig } from 'next';

/**
 * The admin panel is a private application: it is never crawled, never
 * prerendered and never served from a CDN, which is why almost nothing here
 * looks like the website's config.
 */
const config: NextConfig = {
  reactStrictMode: true,

  /**
   * Compile the workspace packages rather than expecting built output.
   *
   * They ship TypeScript source — `main` points at `src/index.ts` — so that a
   * change to the wire format is a compile error in both apps immediately,
   * with no build step in between to forget to run.
   */
  transpilePackages: [
    '@lotuspeak/api-contracts',
    '@lotuspeak/email',
    '@lotuspeak/media',
    '@lotuspeak/seo',
  ],

  images: {
    /**
     * The media store, whichever it is. MinIO in development, Supabase or a
     * CDN in production, read from the same variable the storage driver uses
     * so the two cannot be pointed at different buckets.
     */
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },

  /** Nothing here is for a search engine, and some of it is personal data. */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  experimental: {
    /** The media upload route takes whole photographs. */
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default config;
