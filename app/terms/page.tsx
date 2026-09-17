import type { Metadata } from 'next'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { InfoPage, type InfoSection } from '@/sections/shared/InfoPage'

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
const SECTIONS: InfoSection[] = [
  {
    id: 'general',
    title: '1. Who we are',
    body: [
      'Lotus Peak Tours & Travel is a licensed tour operator based in Thimphu, Bhutan. We sell and operate travel packages, and arrange the accommodation, transport, permits and guiding within them.',
      'These terms govern your use of lotuspeak.org and the services booked through it. Using the site means accepting them.',
      'Everything we operate is arranged under Bhutanese tourism regulation and the guidelines of the Department of Tourism.',
    ],
  },
  {
    id: 'booking',
    title: '2. Booking',
    body: [
      'Bookings are made through us directly — this website, email, or an agent we have authorised.',
      'A booking is confirmed when the deposit is received. The balance falls due before departure. Both amounts and both dates are set out in the written confirmation we send you; nothing is payable before you have that in hand.',
      'Payment can be made by bank transfer or card.',
      'If the balance is not settled by the date in your confirmation, the booking may be cancelled.',
    ],
  },
  {
    id: 'prices',
    title: '3. Prices and what is in them',
    body: [
      'Prices are quoted in US dollars or ngultrum and are per person.',
      'The price covers what the itinerary names: accommodation, meals, transport within Bhutan, permits, guiding, and the Sustainable Development Fee.',
      'It does not cover international airfare, visa charges, travel and medical insurance, personal spending, or optional activities, unless the itinerary says otherwise.',
      'Prices can change before a booking is confirmed — exchange rates move and government fees are revised. Once your booking is confirmed the price is fixed, except where a government fee changes after confirmation, which we will pass on at cost and evidence to you.',
    ],
  },
  {
    id: 'cancellation',
    title: '4. Cancellation and refunds',
    body: [
      'Cancel in writing. The refund depends on how far ahead of arrival you cancel, and the scale is set out in your booking confirmation. Refunds are processed after the cancellation is acknowledged.',
      'Bank and payment-gateway fees may be deducted from what is returned.',
      'If we cancel a departure — which we have to do occasionally, for weather, for a closed road, or because a group does not reach its minimum — you are offered an alternative date or a full refund of what you have paid us.',
    ],
  },
  {
    id: 'insurance',
    title: '5. Insurance',
    body: [
      'Take comprehensive travel and medical insurance before you arrive in Bhutan. It should cover cancellation, medical treatment, accident, and loss of belongings, and on a trek it should cover the altitude you will reach.',
      'We are not liable for costs you incur because you were not insured.',
    ],
  },
  {
    id: 'documents',
    title: '6. Documents',
    body: [
      'It is your responsibility to hold a valid passport, the right visa and permits, and any health documentation required.',
      'We process the Bhutanese visa on your behalf through official channels. We can only do that from the information you give us, so it has to be accurate and it has to match your passport.',
    ],
  },
  {
    id: 'changes',
    title: '7. Changes to an itinerary',
    body: [
      'We operate journeys as planned wherever we can. Weather, flight delays, road closures, local regulation and safety will occasionally make that impossible.',
      'Where it does, we arrange an alternative of equal or similar value. There is no refund for a service you choose not to use, or for a change you make yourself once the journey has begun.',
    ],
  },
  {
    id: 'health',
    title: '8. Health and fitness',
    body: [
      'You should be in reasonable health for the journey you have booked. The trekking journeys ask considerably more than the cultural ones, and the difference is described on each trip page.',
      'Tell us at the time of booking about any medical condition, dietary requirement or particular need. It is almost always something we can work around, and much harder to work around at the airport.',
      'We may decline participation where someone would be a risk to themselves or to others.',
    ],
  },
  {
    id: 'liability',
    title: '9. Liability',
    body: [
      'We take the precautions a careful operator takes. Within that, Lotus Peak Tours & Travel is not liable for injury, illness, loss or damage to property; for delay, cancellation or interruption caused by weather, transport or anything else outside our control; or for the negligence of third parties such as hotels, airlines and transport operators.',
      'Our liability is limited to the amount paid for the service in question.',
    ],
  },
  {
    id: 'content',
    title: '10. Content on this site',
    body: [
      'The text, photographs and artwork on lotuspeak.org belong to Lotus Peak Tours & Travel. Please do not reproduce or redistribute them without asking. We are usually happy to say yes.',
    ],
  },
  {
    id: 'privacy',
    title: '11. Your information',
    body: [
      'We collect what we need to answer your enquiry and to arrange your journey: your name, your contact details, and what you have told us you are hoping for.',
      'We use it for that, and we do not sell it or pass it to anyone beyond the hotels, airlines and authorities your booking requires.',
    ],
  },
  {
    id: 'law',
    title: '12. Governing law',
    body: [
      'These terms are governed by the laws of Bhutan, and any dispute falls to the courts of Bhutan.',
    ],
  },
  {
    id: 'updates',
    title: '13. Changes to these terms',
    body: [
      'We may revise these terms. The version on this page is the current one, and the terms that apply to your booking are the ones in force when it was confirmed.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    body: [
      'Lotus Peak Tours & Travel, Thimphu, Bhutan.',
      'info@lotuspeak.org · +975 17984485 · lotuspeak.org',
    ],
  },
]

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
