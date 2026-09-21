import type { Metadata } from 'next'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { InfoPage, type InfoSection } from '@/sections/shared/InfoPage'

export const metadata: Metadata = {
  title: 'Travellers’ information',
  description:
    'Money, banking, electricity, photography, tipping, dress and etiquette, health and safety — the practical things to know before you travel to Bhutan.',
  openGraph: { images: ogImage(IMG.thimphuValley) },
}

const SECTIONS: InfoSection[] = [
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
