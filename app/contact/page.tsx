import type { Metadata } from 'next'
import { Divider, Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG } from '@/lib/assets'
import { Reveal } from '@/motion'
import { EnquiryForm } from '@/sections/shared/EnquiryForm'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Tell us what you are hoping for. A festival, a long walk, some days of silence. We write back personally, within two days.',
  openGraph: { images: ogImage(IMG.dzong) },
}

export default async function ContactPage() {
  const content = getContent()
  const [settings, trips] = await Promise.all([content.settings.get(), content.trips.list()])

  const options = [
    ...trips.map((t) => ({ label: t.title, value: t.slug })),
    { label: 'Not sure yet', value: 'unsure' },
  ]

  const aside: [string, string][] = [
    ['Call', settings.contact.phone],
    ['Write', 'Use the form; it reaches us directly'],
    ['Find us', 'lotuspeak.org · Facebook'],
    ['Reply', 'We write back personally, within two days.'],
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
