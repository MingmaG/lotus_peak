import type { Metadata } from 'next'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { TERMS_SECTIONS as SECTIONS } from '@/content/data/pages'
import { InfoPage } from '@/sections/shared/InfoPage'

export const metadata: Metadata = {
  title: 'Terms & conditions',
  description:
    'The terms on which Lotus Peak Tours & Travel sells and operates its journeys: booking, payment, cancellation, insurance, changes to an itinerary and liability.',
  openGraph: { images: ogImage(IMG.dzong) },
  robots: { index: true, follow: true },
}

/**
 * Ported from lotuspeak.org/terms-and-conditions.
 *
 * The original is a part-filled template: the company is called "Lotus Peek"
 * throughout, the contact address is a personal Gmail account, and the
 * commercial figures are still square-bracketed placeholders — the deposit
 * percentage, the balance deadline, the three cancellation tiers and the refund
 * processing time. Placeholders must not ship, and a refund policy is not
 * something to invent, so those clauses say here that the figures are the ones
 * in your written booking confirmation.
 *
 * NEEDED FROM LOTUS PEAK, then written into §3 and §5 below:
 *   - deposit: percentage or amount, and whether it is non-refundable
 *   - balance: how many days before departure it falls due
 *   - cancellation: the refund at >30 days, 15–30 days and <15 days
 *   - refunds: how long processing takes
 *
 * This page is a description of Lotus Peak's terms, not legal advice. It should
 * be read by whoever advises the company before launch.
 */

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Terms"
      title="Terms & conditions"
      lead="The terms on which we sell and operate our journeys. The figures particular to your booking — deposit, balance date and the cancellation scale — are in the written confirmation we send you."
      sections={SECTIONS}
      note="Lotus Peak Tours & Travel · Thimphu, Bhutan · Last revised for the 2026 season."
    />
  )
}
