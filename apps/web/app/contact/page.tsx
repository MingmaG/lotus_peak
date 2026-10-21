import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'
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

  /* The row behind this page: its SEO overrides and any JSON-LD the
     office added. Both are also read in `generateMetadata`, which Next
     runs separately — the provider's fetch is tagged and cached, so this
     is one request, not two. */
  const page = await getContent().pages.byPath('/contact')
  const content = getContent()
  const [settings, trips] = await Promise.all([content.settings.get(), content.trips.list()])

  const options = [
    ...trips.map((t) => ({ label: t.title, value: t.slug })),
    { label: 'Not sure yet', value: 'unsure' },
  ]

  /* From the company record. The email and phone are links — on a phone the
     second one dials. The social accounts and the address are the footer's
     too: there was a Facebook link typed here that disagreed with the one
     the office had entered. */
  const promise = settings.contact.replyPromise
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
    ...settings.socials.map((social): [string, ReactNode] => [
      social.label,
      <a key={social.url} href={social.url} rel="noreferrer noopener" target="_blank" style={LINK}>
        {settings.brand}
      </a>,
    ]),
    ...(settings.address.lines.length
      ? [['Where', settings.address.lines.join(', ')] as [string, ReactNode]]
      : []),
    ...(promise
      ? [['Reply', `We write back ${promise.charAt(0).toLowerCase()}${promise.slice(1)}.`] as [string, ReactNode]]
      : []),
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
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForPage({
          path: '/contact',
          title: page?.seo.title ?? page?.title ?? 'Contact',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'Contact', path: '/contact' }],
          extra: page?.seo.schemaJson,
        })}
      />
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
