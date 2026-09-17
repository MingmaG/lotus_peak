'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/design-system'
import { Band, Reveal, type BandProps } from '@/motion'
import { useInquiry } from './SiteChrome'

/** A Band whose CTA navigates. Keeps pages server-rendered. */
export function BandLink({ href, ...band }: BandProps & { href: string }) {
  const router = useRouter()
  return <Band {...band} onCta={() => router.push(href)} />
}

/** A Band whose CTA opens the enquiry drawer, with an inverse button rather than a rule. */
export function BandInquiry({
  label = 'Begin a conversation',
  ...band
}: Omit<BandProps, 'cta' | 'onCta' | 'children'> & { label?: string }) {
  const { open } = useInquiry()
  return (
    <Band {...band}>
      <Reveal delay={840}>
        <Button variant="inverse" size="lg" onClick={() => open()}>
          {label}
        </Button>
      </Reveal>
    </Band>
  )
}
