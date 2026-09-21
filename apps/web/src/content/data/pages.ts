import { IMG } from '@/lib/assets'

/**
 * The words on the editorial pages.
 *
 * These were literals inside the page components — which meant a typo in the
 * terms was a deploy, and the office could not touch any of it. They are here,
 * in a module with no React in it, for two reasons: the page still imports
 * them so nothing about the rendered site changes, and `scripts/export-pages`
 * can import them too without dragging the whole component tree into a Node
 * script.
 *
 * This file is a **staging post**. When the pages read from the repository —
 * `docs/PLAN.md` phase 5 — it goes, and its contents are rows in `pages`.
 */

/** A paragraph, or a list of them. */
export type InfoBlock = string | { list: string[] }

export type InfoSection = {
  id: string
  title: string
  body: InfoBlock[]
}

/* -------------------------------------------------------------------------- */
/*  Home                                                                       */
/* -------------------------------------------------------------------------- */


export const HOME_PURPOSES: [string, string][] = [
  ['Guided by teachers', 'Journeys are led with Rinpoches and Lams, in monasteries and on pilgrimage paths.'],
  ['Meditation on the road', 'Drives between valleys are practice too: attention to what passes by.'],
  [
    'A share returned',
    'Thirty percent of our income supports Osel Ling Perila Goenpa, a monastery in the hills.',
  ],
]

/* -------------------------------------------------------------------------- */
/*  About                                                                      */
/* -------------------------------------------------------------------------- */

export const COMMITMENTS: [string, string][] = [
  ['Mindfulness guide', 'We teach meditation as a lifelong skill, not a holiday activity. It opens the mind to see the world as it is.'],
  ['Peaceful journey', 'Loving compassion opens the heart. We travel that way, and you are welcome to.'],
]

export const ABOUT_PURPOSES: [string, string, string][] = [
  [
    'Travel with heart.',
    'A journey is not the reaching of a destination. Every day is built around intention, awareness and going slowly enough to notice — the landscapes and the living traditions, and also what they do to you while you are in them.',
    IMG.rainbow,
  ],
  [
    'Travel with guided principles.',
    'The journeys are shaped with Rinpoches and Lams, and rooted in their teaching. You meditate in the monasteries, walk the pilgrimage paths, and sit in silence where people have sat for eight hundred years. The lineage is doing the work; we are only arranging the days around it.',
    IMG.recitation,
  ],
  [
    'Arts, crafts and living Jomzo.',
    'Zorig Chusum, the thirteen arts. Jomzo is the one that shapes clay, copper and gold into sacred images, and the workshops are open: you can stand at the bench while a figure comes up out of the clay, and try it yourself. Not an exhibition — a trade still being practised.',
    IMG.jomzo,
  ],
]

/* -------------------------------------------------------------------------- */
/*  Terms                                                                      */
/* -------------------------------------------------------------------------- */

export const TERMS_SECTIONS: InfoSection[] = [
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

/* -------------------------------------------------------------------------- */
/*  Travellers' information                                                    */
/* -------------------------------------------------------------------------- */

export const TRAVELLER_SECTIONS: InfoSection[] = [
  {
    id: 'insurance',
    title: 'Travel and medical insurance',
    body: [
      'The Royal Insurance Corporation of Bhutan runs a travel and medical plan for visitors. You can arrange it through us, through your own agent at home, or directly at ricb.com.bt.',
      'Take cover before you travel, whoever you take it with. It is the one thing we ask of everybody.',
    ],
  },
  {
    id: 'money',
    title: 'Money',
    body: [
      'The currency is the ngultrum (Nu.), pegged to the Indian rupee, and rupees are accepted almost everywhere. Most hotels, restaurants and handicraft shops take cards.',
      'The banking network is good. Bank of Bhutan, Bhutan National Bank, Druk PNB and Tashi Bank all handle exchange and traveller’s cheques, and all offer internet banking.',
    ],
  },
  {
    id: 'electricity',
    title: 'Electricity',
    body: [
      'Supply is 220/240 volts, on round two- and three-pin sockets. Bring a universal adapter or a flat-to-round converter.',
      'All of it is hydropower. Bhutan is carbon negative, and the electricity is part of how.',
    ],
  },
  {
    id: 'photography',
    title: 'Photography',
    body: [
      'Ask your guide before photographing inside a dzong, temple or monastery. In most it is not allowed, and in a few it is; the rule differs building by building and your guide will know.',
      'Outside, photograph freely: the landscapes, the architecture, the villages and the festivals.',
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    body: [
      'What is worth carrying home:',
      {
        list: [
          'Hand-woven textiles, in silk and raw silk',
          'Carved wooden masks',
          'Bamboo and cane baskets',
          'Dapas, the turned wooden bowls',
          'Handmade paper',
          'Silver work and thangka paintings',
          'Bhutanese stamps, which are a small obsession of their own',
        ],
      },
      'Buying or selling antiques is prohibited. If something is old enough to be interesting, ask before you buy it.',
    ],
  },
  {
    id: 'tipping',
    title: 'Gratuity',
    body: [
      'Tipping is not expected and it is not built into anything. Most travellers give something to their guide and driver at the end of a journey, usually in an envelope.',
      'On a trek, the cook, the assistant cook and the horsemen are usually included in that.',
    ],
  },
  {
    id: 'communication',
    title: 'Getting in touch',
    body: [
      'Mobile coverage is good nationwide and international roaming works with most operators. Hotels, cafés and restaurants have wi-fi.',
      'On the Jomolhari route there are stretches with no signal for a day or more. We tell you in advance where those are.',
    ],
  },
  {
    id: 'clothing',
    title: 'Clothing and etiquette',
    body: [
      'Pack for mixed conditions. The valleys differ by a thousand metres and the temperature with them, and a warm afternoon becomes a cold evening quickly.',
      'In a dzong, temple or monastery:',
      {
        list: [
          'Cover your arms and legs — long trousers or a long skirt, and sleeves',
          'Take off hats and caps before you go in',
          'Take off shoes at the door of a temple room',
          'Stand rather than sit where the national flag is raised',
        ],
      },
      'Modest dress and a quiet manner are noticed and appreciated. That is most of it.',
    ],
  },
  {
    id: 'measures',
    title: 'Measures and time',
    body: ['Bhutan is metric, and the time is GMT +6.'],
  },
  {
    id: 'health',
    title: 'Health',
    body: [
      'See your doctor before you travel. Tetanus, typhoid and hepatitis A are the usual recommendations.',
      'Bring your own prescriptions and a small personal first-aid kit. Your guide carries one for the group, and on a trek it is a proper one.',
      'Altitude matters more than anything else on the high journeys. The itineraries are built to acclimatise, and if anyone needs to go down, we go down.',
    ],
  },
  {
    id: 'safety',
    title: 'Safety',
    body: [
      'Bhutan is among the safest countries in the world to travel in. The ordinary precautions still apply:',
      {
        list: [
          'Keep your passport, wallet and camera with you or locked away',
          'Do not leave bags unattended or visible in a vehicle',
          'Drink boiled or bottled water, and avoid ice made from the tap',
        ],
      },
      'The laws on tobacco and drugs are strict. The Tobacco Control Act limits how much you may bring in for personal use; observe it.',
    ],
  },
  {
    id: 'finally',
    title: 'One last thing',
    body: [
      'The environment and the culture here are intact because they are protected, and a good deal of that protection is ordinary courtesy practised by everybody who comes. Travel gently and you are part of the reason it stays as it is.',
    ],
  },
]
