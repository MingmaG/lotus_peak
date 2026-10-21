/** @type {import('next').NextConfig} */
const YEAR = 60 * 60 * 24 * 365

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
    /**
     * Photographs come from the media store, not from this box.
     *
     * `src/lib/image-loader.ts` turns a width into the rendition the panel
     * already built at that width, so `next/image` emits media-store URLs and
     * `/_next/image` is never requested. What used to be here went with it:
     * `formats`, because nothing re-encodes any more; `minimumCacheTTL`,
     * because there is no optimiser cache to keep warm; and `remotePatterns`,
     * which only ever guarded the built-in optimiser and is not consulted once
     * a loader is set — leaving it would suggest this box still fetches the
     * photographs, and it does not.
     */
    loaderFile: './src/lib/image-loader.ts',

    /**
     * The rendition ladder, exactly — `RENDITION_WIDTHS` in `@lotuspeak/media`.
     *
     * Not a detail. `next/image` builds `srcset` from these widths and the
     * loader snaps each one to the nearest rendition at or below it, so a list
     * that disagrees with the ladder produces a `srcset` naming the same file
     * three times: 828, 1080 and 1200 all snap to 1200. Kept in step by hand
     * because this file cannot import from a workspace package.
     */
    deviceSizes: [400, 800, 1200, 1600, 2400],
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
   *
   * This is now the whole of what the box serves image-shaped: the brand
   * chrome. Every photograph a visitor sees is fetched from the media store.
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
