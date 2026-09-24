/** @type {import('next').NextConfig} */
const YEAR = 60 * 60 * 24 * 365

/**
 * Where the photographs come from.
 *
 * `MEDIA_PUBLIC_URL` is the admin panel's media store — MinIO in development,
 * Supabase or a CDN in production — and it is the same variable the admin sets
 * on its storage driver, so the two cannot be pointed at different buckets.
 *
 * Without an entry here every photograph on the site is a 500: `next/image`
 * refuses a remote host it was not told about, and the error names the
 * hostname rather than this file.
 */
function mediaPattern() {
  const raw = process.env.MEDIA_PUBLIC_URL
  if (!raw) return []
  try {
    const url = new URL(raw)
    return [
      {
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: '/**',
      },
    ]
  } catch {
    console.warn(`[next.config] MEDIA_PUBLIC_URL is not a URL: ${raw}`)
    return []
  }
}

const nextConfig = {
  reactStrictMode: true,

  /**
   * The workspace packages ship TypeScript source rather than built output, so
   * a change to the wire format is a compile error in both apps at once with
   * no build step in between to forget to run.
   */
  transpilePackages: [
    '@lotuspeak/api-contracts',
    '@lotuspeak/email',
    '@lotuspeak/media',
    '@lotuspeak/seo',
  ],

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920, 2400],
    // The originals under public/assets are immutable between deploys, so a
    // derivative never needs re-encoding within one. Without this the optimiser
    // re-encodes on a 60s cycle and the first visitor after each one pays for it.
    minimumCacheTTL: YEAR,
    remotePatterns: mediaPattern(),
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * Next serves /public with `cache-control: public, max-age=0`, which makes a
   * repeat visitor revalidate every font and every original on every page.
   *
   * Fonts are safe to pin for a year: they are content-stable, and a re-export
   * changes the subset filenames (`-latin`, `-latin-ext`) rather than the bytes
   * behind one. Images are not — the filenames are editorial, so a photo can be
   * replaced under the same name. They get a day, then a week of
   * stale-while-revalidate, which is invisible to visitors and still correct.
   */
  async headers() {
    // Every matching entry is applied in order and the last one wins, so the
    // narrower font rule has to come after the catch-all, not before it.
    return [
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/assets/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: `public, max-age=${YEAR}, immutable` }],
      },
    ]
  },
}

export default nextConfig
