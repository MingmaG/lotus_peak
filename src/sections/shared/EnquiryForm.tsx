'use client'

import { useState, type FormEvent } from 'react'
import { Button, Checkbox, Input, Select } from '@/design-system'
import { useInquiry } from './SiteChrome'

export type EnquiryFormProps = {
  source: 'contact' | 'trip-detail'
  /** Trip detail pre-fills the journey and does not offer a choice. */
  fixedTrip?: { slug: string; title: string }
  tripOptions?: { label: string; value: string }[]
  /** Contact asks for adults/children; trip detail asks for a party size band. */
  variant?: 'full' | 'compact'
}

export function EnquiryForm({ source, fixedTrip, tripOptions, variant = 'compact' }: EnquiryFormProps) {
  const { notify } = useInquiry()
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>

    const next: Record<string, string> = {}
    if (!data.name?.trim()) next.name = 'We need a name to write back to.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email ?? '')) next.email = 'That email does not look right.'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }

    setPending(true)
    await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, source, tripSlug: fixedTrip?.slug ?? data.tripSlug }),
    }).catch(() => {})
    setPending(false)
    form.reset()
    notify('Sent. We will write back within two days.')
  }

  return (
    <form
      onSubmit={onSubmit}
      style={
        variant === 'full'
          ? { display: 'grid', gap: 24, maxWidth: 640 }
          : {
              padding: 40,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              display: 'grid',
              gap: 24,
            }
      }
    >
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {fixedTrip && (
        <>
          <input type="hidden" name="tripSlug" value={fixedTrip.slug} />
          <div>
            <div
              style={{
                fontSize: 'var(--text-label)',
                fontWeight: 500,
                letterSpacing: 'var(--tracking-label)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              Journey
            </div>
            <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-hairline)' }}>
              {fixedTrip.title}
            </div>
          </div>
        </>
      )}

      <div className="lp-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Input
          label="Your name"
          name="name"
          required
          autoComplete="name"
          placeholder="As it appears in your passport"
          error={errors.name}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email}
        />
      </div>

      <div className="lp-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Input label="Country" name="country" autoComplete="country-name" placeholder="Where you live" />
        <Input label="Contact number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+" />
      </div>

      {!fixedTrip && tripOptions && <Select label="Trip" name="tripSlug" options={tripOptions} />}

      {variant === 'full' ? (
        <div className="lp-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Input label="Adults" name="adults" inputMode="numeric" placeholder="2" />
          <Input label="Children" name="children" inputMode="numeric" placeholder="0" />
        </div>
      ) : (
        <div className="lp-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Select
            label="Travellers"
            name="travellers"
            options={['One', 'Two', 'Three or four', 'Five or more']}
          />
          <Input label="Preferred dates" name="preferredDates" placeholder="A month, or a season" />
        </div>
      )}

      <Input
        label={variant === 'full' ? 'Your message' : 'What are you hoping for'}
        name="message"
        multiline
        placeholder="A festival, a long walk, some days of silence…"
      />

      {variant === 'full' && (
        <Checkbox label="I would like rest days written in" name="restDays" defaultChecked />
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending' : variant === 'full' ? 'Send' : 'Begin a conversation'}
        </Button>
      </div>
    </form>
  )
}
