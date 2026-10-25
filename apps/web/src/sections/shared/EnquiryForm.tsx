'use client'

import { useState, type FormEvent } from 'react'
import { ENQUIRY_LIMITS, countWords } from '@lotuspeak/api-contracts'
import { Button, Checkbox, Input, Select } from '@/design-system'
import { enquiryErrors } from '@/lib/enquiry-rules'
import { sendEnquiry } from '@/lib/send-enquiry'
import { Captcha } from './Captcha'
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
  const { notify, email, captchaSiteKey } = useInquiry()
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [words, setWords] = useState(0)
  const [captchaReset, setCaptchaReset] = useState(0)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>

    const next = enquiryErrors(data, { captcha: captchaSiteKey !== null })
    setErrors(next)
    if (Object.keys(next).length > 0) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }

    setPending(true)
    const outcome = await sendEnquiry({
      ...data,
      source,
      tripSlug: fixedTrip?.slug ?? data.tripSlug,
    }, email)
    setPending(false)
    /* The token is spent whatever the answer was; the next attempt needs a
       fresh one, and a refusal keeps everything else that was written. */
    setCaptchaReset((n) => n + 1)

    /* The form is reset only once the server says it holds the enquiry —
       otherwise what the traveller wrote is cleared along with it. */
    if (!outcome.sent) {
      notify(outcome.message)
      return
    }

    form.reset()
    setWords(0)
    notify('Sent. We will write back within two days.')
  }

  return (
    <form
      noValidate
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
        <Input
          label="Contact number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+"
          maxLength={40}
          error={errors.phone}
        />
      </div>

      {!fixedTrip && tripOptions && <Select label="Trip" name="tripSlug" options={tripOptions} />}

      {variant === 'full' ? (
        <div className="lp-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Input
            label="Adults"
            name="adults"
            type="number"
            inputMode="numeric"
            min={ENQUIRY_LIMITS.adults.min}
            max={ENQUIRY_LIMITS.adults.max}
            step={1}
            placeholder="2"
            error={errors.adults}
          />
          <Input
            label="Children"
            name="children"
            type="number"
            inputMode="numeric"
            min={ENQUIRY_LIMITS.children.min}
            max={ENQUIRY_LIMITS.children.max}
            step={1}
            placeholder="0"
            error={errors.children}
          />
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
        hint={`${words} of ${ENQUIRY_LIMITS.messageWords} words`}
        error={errors.message}
        onChange={(e) => setWords(countWords(e.currentTarget.value))}
      />

      {variant === 'full' && (
        <Checkbox label="I would like rest days written in" name="restDays" defaultChecked />
      )}

      {captchaSiteKey && (
        <Captcha
          siteKey={captchaSiteKey}
          resetKey={captchaReset}
          error={errors.captchaToken}
          onChange={(ready) => ready && setErrors(({ captchaToken: _, ...rest }) => rest)}
        />
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending' : variant === 'full' ? 'Send' : 'Begin a conversation'}
        </Button>
      </div>
    </form>
  )
}
