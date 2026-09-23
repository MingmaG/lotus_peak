'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Button,
  Checkbox,
  Footer,
  InquiryDrawer,
  Input,
  NavBar,
  Select,
  Toast,
  type FooterColumn,
  type NavItem,
} from '@/design-system'
import { Dignities, Halo } from '@/motion'
import { sendEnquiry } from '@/lib/send-enquiry'
import type { Destination, SiteSettings, Trip } from '@/content/types'

type DrawerCtx = {
  open: (tripSlug?: string) => void
  notify: (message: string) => void
  /** The company's email, for a form to offer when its enquiry did not arrive. */
  email: string
}
const Ctx = createContext<DrawerCtx>({ open: () => {}, notify: () => {}, email: '' })

/** Any CTA anywhere can open the enquiry drawer or raise the toast. */
export function useInquiry() {
  return useContext(Ctx)
}

/**
 * Routes that open with a full-bleed photograph and need white-on-image nav.
 *
 * Culture pieces, valleys and places open with the same `CoverImage` as a
 * journal entry, and were missing here — an ink nav on a photograph.
 */
const INVERSE = (path: string) =>
  path === '/' ||
  path === '/culture' ||
  path === '/destinations' ||
  /^\/trips\/[^/]+$/.test(path) ||
  /^\/culture\/[^/]+$/.test(path) ||
  /^\/destinations\/[^/]+(\/[^/]+)?$/.test(path) ||
  /^\/journal\/[^/]+$/.test(path)

export function SiteChrome({
  settings,
  trips,
  destinations,
  children,
}: {
  settings: SiteSettings
  trips: Pick<Trip, 'slug' | 'title' | 'durationDays'>[]
  /** The valleys, for the menu map's places to lead to. */
  destinations: Pick<Destination, 'name' | 'path'>[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [preselect, setPreselect] = useState<string | undefined>()
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const open = useCallback((tripSlug?: string) => {
    setPreselect(tripSlug)
    setDrawerOpen(true)
  }, [])

  const email = settings.contact.email
  const ctx = useMemo(() => ({ open, notify, email }), [open, notify, email])

  // Close the drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname])

  const navItems: NavItem[] = settings.nav
  const active = navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.label

  const journeyOptions = [
    ...trips.map((t) => ({ label: `${t.title}, ${t.durationDays} days`, value: t.slug })),
    { label: 'Not sure yet', value: 'unsure' },
  ]

  const { footer } = settings
  const columns: FooterColumn[] = footer.show.links ? footer.columns : []

  return (
    <Ctx.Provider value={ctx}>
      <Dignities />
      <Halo />

      <NavBar
        items={navItems}
        active={active}
        cta={settings.navCta}
        inverse={INVERSE(pathname)}
        mapDestinations={destinations}
        pathname={pathname}
      />

      <div
        key={pathname}
        id="main"
        style={{ position: 'relative', zIndex: 1, animation: 'surface 1.6s var(--ease-settle) both' }}
      >
        {children}
      </div>

      <Footer
        brand={settings.brand}
        line={footer.note}
        columns={columns}
        address={footer.show.address ? settings.address.lines : []}
        mapUrl={settings.address.mapUrl}
        contacts={footer.show.contacts ? settings.contacts : []}
        socials={footer.show.socials ? settings.socials : []}
        copyright={footer.copyright}
        credit={footer.credit}
      />

      <InquiryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer="No deposit, no obligation. Just a reply."
      >
        <DrawerForm
          email={email}
          options={journeyOptions}
          preselect={preselect}
          onSent={() => {
            setDrawerOpen(false)
            notify('Sent. We will write back within two days.')
          }}
          onFailed={notify}
        />
      </InquiryDrawer>

      {/* Bounded on the right as well as the left: the toast is inline-flex, so
          on a phone the sentence wraps inside the screen instead of running off
          it. On a wide screen it still hugs its text in the bottom corner. */}
      <div style={{ position: 'fixed', left: 32, right: 32, bottom: 32, zIndex: 200, pointerEvents: 'none' }}>
        <Toast open={!!toast} message={toast ?? ''} />
      </div>
    </Ctx.Provider>
  )
}

function DrawerForm({
  email,
  options,
  preselect,
  onSent,
  onFailed,
}: {
  email: string
  options: { label: string; value: string }[]
  preselect?: string
  onSent: () => void
  onFailed: (message: string) => void
}) {
  const [pending, setPending] = useState(false)

  return (
    <form
      style={{ display: 'grid', gap: 32 }}
      onSubmit={async (e) => {
        e.preventDefault()
        setPending(true)
        const data = Object.fromEntries(new FormData(e.currentTarget))
        const outcome = await sendEnquiry({ ...data, source: 'drawer' }, email)
        setPending(false)
        /* A refused enquiry leaves the drawer open with the words still in it,
           so there is something to try again with. */
        if (!outcome.sent) {
          onFailed(outcome.message)
          return
        }
        onSent()
      }}
    >
      <Input label="Your name" name="name" required placeholder="As it appears in your passport" autoComplete="name" />
      <Input label="Email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
      <Select label="Which journey" name="tripSlug" options={options} defaultValue={preselect} />
      <Input
        label="What are you hoping for"
        name="message"
        multiline
        placeholder="A festival, a long walk, some quiet…"
      />
      <Checkbox label="I would like rest days written in" name="restDays" defaultChecked />
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending' : 'Send'}
      </Button>
    </form>
  )
}
