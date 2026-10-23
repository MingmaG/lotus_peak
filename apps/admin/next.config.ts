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

  /**
   * OAuth discovery for AI clients, at the well-known addresses they fetch
   * before they hold any credential. Rewrites rather than an `app/.well-known`
   * folder, because a dot-directory in the app router is an argument with the
   * bundler nobody needs. The `/api/mcp`-suffixed forms are what the MCP
   * specification tells a client to try first when the resource has a path.
   */
  async rewrites() {
    return [
      { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth/well-known/protected-resource' },
      { source: '/.well-known/oauth-protected-resource/api/mcp', destination: '/api/oauth/well-known/protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/well-known/authorization-server' },
      { source: '/.well-known/oauth-authorization-server/api/mcp', destination: '/api/oauth/well-known/authorization-server' },
    ];
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
