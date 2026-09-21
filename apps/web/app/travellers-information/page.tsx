import type { Metadata } from 'next'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { TRAVELLER_SECTIONS as SECTIONS } from '@/content/data/pages'
import { InfoPage } from '@/sections/shared/InfoPage'

export const metadata: Metadata = {
  title: 'Travellers’ information',
  description:
    'Money, banking, electricity, photography, tipping, dress and etiquette, health and safety — the practical things to know before you travel to Bhutan.',
  openGraph: { images: ogImage(IMG.thimphuValley) },
}

export default function TravellersInformationPage() {
  return (
    <InfoPage
      eyebrow="Travellers"
      title="What to know before you come"
      lead="Not a complete list — the things travellers ask us most. Anything specific to your journey is in the notes we send when it is booked."
      sections={SECTIONS}
      note="Last reviewed for the 2026 season. Ask us if you are reading this later than that."
    />
  )
}
