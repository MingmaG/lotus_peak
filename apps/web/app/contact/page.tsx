import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { Divider, Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG } from '@/lib/assets'
import { Reveal } from '@/motion'
import { EnquiryForm } from '@/sections/shared/EnquiryForm'

/**
 * `generateMetadata` rather than a `metadata` constant.
 *
 * The description names the email address and the telephone number, and those
 * are the company record. A constant cannot read it, which is how this page
 * ended up publishing a number the office had already changed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getContent().settings.get()
  return {
    title: 'Contact',
    description:
      'Tell us what you are hoping for. A festival, a long walk, some days of silence. ' +
      `Write to ${settings.contact.email}, call ${settings.contact.phone}, or use the form — ` +
      `we reply ${settings.contact.replyPromise.toLowerCase()}.`,
    openGraph: { images: ogImage(IMG.dzong) },
  }
}

const LINK: CSSProperties = { color: 'inherit', textDecorationColor: 'var(--gold)', textUnderlineOffset: 4 }

export default async function ContactPage() {
  const content = getContent()
  const [settings, trips] = await Promise.all([content.settings.get(), content.trips.list()])

  const options = [
    ...trips.map((t) => ({ label: t.title, value: t.slug })),
    { label: 'Not sure yet', value: 'unsure' },
  ]

  /* From the company record. The email and phone are links — on a phone the
     second one dials. */
  const aside: [string, ReactNode][] = [
    [
      'Call',
      <a key="phone" href={`tel:${settings.contact.phone.replace(/\s+/g, '')}`} style={LINK}>
        {settings.contact.phone}
      </a>,
    ],
    [
      'Email',
      <a key="email" href={`mailto:${settings.contact.email}`} style={LINK}>
        {settings.contact.email}
      </a>,
    ],
    [
      'Facebook',
      <a
        key="fb"
        href="https://www.facebook.com/profile.php?id=61588546391091"
        rel="noreferrer noopener"
        target="_blank"
        style={LINK}
      >
        Lotus Peak Tours &amp; Travel
      </a>,
    ],
    ['Where', 'Thimphu, Bhutan'],
    ['Reply', settings.contact.replyPromise === 'Personally, within two days' ? 'We write back personally, within two days.' : settings.contact.replyPromise],
  ]

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container)',
        margin: '0 auto',
      }}
    >
      {/* The design project leaves this page entirely unanimated (audit B3). */}
      <Reveal>
        <Eyebrow number="Contact">Enquiry</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '18ch' }}>Begin a conversation</h1>
      </Reveal>

      <div
        className="lp-two-col"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 380px',
          gap: 'var(--space-10)',
          marginTop: 'var(--space-8)',
        }}
      >
        <Reveal delay={200}>
          <EnquiryForm source="contact" variant="full" tripOptions={options} />
        </Reveal>

        <Reveal delay={400}>
          <aside style={{ alignSelf: 'start' }}>
            <Divider variant="kera" />
            <div style={{ display: 'grid', gap: 28, paddingTop: 28 }}>
              {aside.map(([t, b]) => (
                <div key={t}>
                  <Eyebrow tone="muted">{t}</Eyebrow>
                  <p style={{ marginTop: 8 }}>{b}</p>
                </div>
              ))}
            </div>
            <Divider style={{ margin: '28px 0' }} />
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
              No deposit, no obligation. Just a reply.
            </p>
          </aside>
        </Reveal>
      </div>
    </main>
  )
}
