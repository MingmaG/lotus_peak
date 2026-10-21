import type { Metadata } from 'next'
import { getContent } from '@/content'
import { IMG } from '@/lib/assets'
import { siteUrl } from '@/lib/env'
import { ogImage } from '@/lib/seo'
import { SiteChrome } from '@/sections/shared/SiteChrome'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getContent().settings.get()
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: settings.defaultSeo.title, template: '%s — Lotus Peak' },
    description: settings.defaultSeo.description,
    openGraph: {
      type: 'website',
      siteName: settings.brand,
      title: settings.defaultSeo.title,
      description: settings.defaultSeo.description,
      images: ogImage(IMG.taktshang),
    },
    twitter: { card: 'summary_large_image' },
  }
}

/**
 * Sets `motion-ready` before first paint, so the entrance animations only ever
 * apply in a browser that will actually run them. Without JS, before hydration,
 * or under reduced motion, the page renders in its finished state
 * (docs/audit/effects-integration.md B4).
 */
const MOTION_READY = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion-ready')}catch(e){}`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = getContent()
  const [settings, trips, destinations] = await Promise.all([
    content.settings.get(),
    content.trips.list(),
    content.destinations.list(),
  ])

  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/assets/fonts/Commissioner-Regular-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Commissioner-Bold-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: MOTION_READY }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteChrome
          settings={settings}
          trips={trips.map((t) => ({ slug: t.slug, title: t.title, durationDays: t.durationDays }))}
          /* Valleys only: the map's places are towns and districts, and a
             place page (a lhakhang, a dzong) is never what one of them means. */
          destinations={destinations
            .filter((d) => d.parentSlug === null)
            .map((d) => ({ name: d.name, path: d.path }))}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  )
}
