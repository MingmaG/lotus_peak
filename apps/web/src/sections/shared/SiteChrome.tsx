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
import { ENQUIRY_LIMITS, countWords } from '@lotuspeak/api-contracts'
import { enquiryErrors } from '@/lib/enquiry-rules'
import { sendEnquiry } from '@/lib/send-enquiry'
import type { Destination, SiteSettings, Trip } from '@/content/types'
import { AnnouncementBar } from './AnnouncementBar'
import { BannerPopup, PageEndBanners } from './Banners'
import { Captcha } from './Captcha'
import { WhatsAppFloat } from './WhatsAppFloat'

type DrawerCtx = {
  open: (tripSlug?: string) => void
  notify: (message: string) => void
  /** The company's email, for a form to offer when its enquiry did not arrive. */
  email: string
  /** Turnstile's site key, or null when the panel asks for no check. */
  captchaSiteKey: string | null
}
const Ctx = createContext<DrawerCtx>({ open: () => {}, notify: () => {}, email: '', captchaSiteKey: null })

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
  renderedAt,
  children,
}: {
  settings: SiteSettings
  trips: Pick<Trip, 'slug' | 'title' | 'durationDays'>[]
  /** The valleys, for the menu map's places to lead to. */
  destinations: Pick<Destination, 'name' | 'path'>[]
  /**
   * When the server rendered this page. Announcements and banners compare
   * their dates against it until the browser's own clock takes over, so the
   * server's HTML and the first client render agree (see `lib/notices.ts`).
   */
  renderedAt: number
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
  const captchaSiteKey = settings.captchaSiteKey
  const ctx = useMemo(() => ({ open, notify, email, captchaSiteKey }), [open, notify, email, captchaSiteKey])

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

      <AnnouncementBar announcements={settings.announcements} pathname={pathname} renderedAt={renderedAt} />

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

      <PageEndBanners banners={settings.banners} pathname={pathname} renderedAt={renderedAt} />

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
          captchaSiteKey={captchaSiteKey}
          open={drawerOpen}
          options={journeyOptions}
          preselect={preselect}
          onSent={() => {
            setDrawerOpen(false)
            notify('Sent. We will write back within two days.')
          }}
          onFailed={notify}
        />
      </InquiryDrawer>

      <BannerPopup
        banners={settings.banners}
        pathname={pathname}
        renderedAt={renderedAt}
        suppressed={drawerOpen}
      />

      {settings.whatsapp && <WhatsAppFloat whatsapp={settings.whatsapp} pathname={pathname} trips={trips} />}

      {/* Bounded on the right as well as the left: the toast is inline-flex, so
          on a phone the sentence wraps inside the screen instead of running off
          it. On a wide screen it still hugs its text in the bottom corner —
          above the WhatsApp button where there is one, which shares the corner
          and would otherwise sit on top of the first words. */}
      <div
        style={{
          position: 'fixed',
          left: 32,
          right: 32,
          bottom: settings.whatsapp ? 104 : 32,
          zIndex: 200,
          pointerEvents: 'none',
        }}
      >
        <Toast open={!!toast} message={toast ?? ''} />
      </div>
    </Ctx.Provider>
  )
}

function DrawerForm({
  email,
  captchaSiteKey,
  open,
  options,
  preselect,
  onSent,
  onFailed,
}: {
  email: string
  captchaSiteKey: string | null
  /** Whether the drawer is showing. The form stays mounted when it is not. */
  open: boolean
  options: { label: string; value: string }[]
  preselect?: string
  onSent: () => void
  onFailed: (message: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [words, setWords] = useState(0)
  const [captchaReset, setCaptchaReset] = useState(0)

  return (
    <form
      noValidate
      style={{ display: 'grid', gap: 32 }}
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        const data = Object.fromEntries(new FormData(form))
        const next = enquiryErrors(data, { captcha: captchaSiteKey !== null })
        setErrors(next)
        if (Object.keys(next).length > 0) {
          form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
          return
        }

        setPending(true)
        const outcome = await sendEnquiry({ ...data, source: 'drawer' }, email)
        setPending(false)
        /* The token is spent whatever the answer was. */
        setCaptchaReset((n) => n + 1)
        /* A refused enquiry leaves the drawer open with the words still in it,
           so there is something to try again with. */
        if (!outcome.sent) {
          onFailed(outcome.message)
          return
        }
        onSent()
      }}
    >
      <Input
        label="Your name"
        name="name"
        required
        placeholder="As it appears in your passport"
        autoComplete="name"
        error={errors.name}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email}
      />
      <Select label="Which journey" name="tripSlug" options={options} defaultValue={preselect} />
      <Input
        label="What are you hoping for"
        name="message"
        multiline
        placeholder="A festival, a long walk, some quiet…"
        hint={`${words} of ${ENQUIRY_LIMITS.messageWords} words`}
        error={errors.message}
        onChange={(e) => setWords(countWords(e.currentTarget.value))}
      />
      <Checkbox label="I would like rest days written in" name="restDays" defaultChecked />
      {/* Only while the drawer is open. The form is mounted on every page,
          and a check drawn behind a closed drawer would load Cloudflare's
          script everywhere and spend its token's five minutes unseen. */}
      {captchaSiteKey && open && (
        <Captcha
          siteKey={captchaSiteKey}
          resetKey={captchaReset}
          error={errors.captchaToken}
          onChange={(ready) => ready && setErrors(({ captchaToken: _, ...rest }) => rest)}
        />
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending' : 'Send'}
      </Button>
    </form>
  )
}
