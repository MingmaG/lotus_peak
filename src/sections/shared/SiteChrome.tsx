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
import type { SiteSettings, Trip } from '@/content/types'

type DrawerCtx = { open: (tripSlug?: string) => void; notify: (message: string) => void }
const Ctx = createContext<DrawerCtx>({ open: () => {}, notify: () => {} })

/** Any CTA anywhere can open the enquiry drawer or raise the toast. */
export function useInquiry() {
  return useContext(Ctx)
}

/** Routes that open with a full-bleed hero and need white-on-image nav. */
const INVERSE = (path: string) => path === '/' || path === '/culture' || /^\/trips\/[^/]+$/.test(path)

export function SiteChrome({
  settings,
  trips,
  children,
}: {
  settings: SiteSettings
  trips: Pick<Trip, 'slug' | 'title' | 'durationDays'>[]
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

  const ctx = useMemo(() => ({ open, notify }), [open, notify])

  // Close the drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname])

  const navItems: NavItem[] = settings.nav
  const active = navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.label

  const journeyOptions = [
    ...trips.map((t) => ({ label: `${t.title}, ${t.durationDays} days`, value: t.slug })),
    { label: 'Not sure yet', value: 'unsure' },
  ]

  const columns: FooterColumn[] = settings.footer.columns

  return (
    <Ctx.Provider value={ctx}>
      <Dignities />
      <Halo />

      <NavBar
        items={navItems}
        active={active}
        cta={settings.navCta}
        inverse={INVERSE(pathname)}
      />

      <div
        key={pathname}
        id="main"
        style={{ position: 'relative', zIndex: 1, animation: 'surface 1.6s var(--ease-settle) both' }}
      >
        {children}
      </div>

      <Footer brand={settings.brand} line={settings.line} columns={columns} note={settings.footer.note} />

      <InquiryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer="No deposit, no obligation. Just a reply."
      >
        <DrawerForm
          options={journeyOptions}
          preselect={preselect}
          onSent={() => {
            setDrawerOpen(false)
            notify('Sent. We will write back within two days.')
          }}
        />
      </InquiryDrawer>

      <div style={{ position: 'fixed', left: 32, bottom: 32, zIndex: 200, pointerEvents: 'none' }}>
        <Toast open={!!toast} message={toast ?? ''} />
      </div>
    </Ctx.Provider>
  )
}

function DrawerForm({
  options,
  preselect,
  onSent,
}: {
  options: { label: string; value: string }[]
  preselect?: string
  onSent: () => void
}) {
  const [pending, setPending] = useState(false)

  return (
    <form
      style={{ display: 'grid', gap: 32 }}
      onSubmit={async (e) => {
        e.preventDefault()
        setPending(true)
        const data = Object.fromEntries(new FormData(e.currentTarget))
        await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...data, source: 'drawer' }),
        }).catch(() => {})
        setPending(false)
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
