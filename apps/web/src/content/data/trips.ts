import { IMG } from '@/lib/assets'
import type { Trip } from '../types'

/**
 * The five journeys.
 *
 * `valleys` is verbatim from the design project. The itineraries, highlights,
 * inclusions and FAQ for `meditation`, `festival` and `jomolhari` do not exist
 * there — the prototype silently falls through to the valleys itinerary
 * (docs/audit/effects-integration.md B14). They are drafted here from each
 * journey's own description, region list, length and altitude so the site is
 * complete and honest, and they NEED LOTUS PEAK'S SIGN-OFF before launch.
 */

const SHARED_INCLUDED = [
  'Airport transfers in our own vehicle',
  'All transport within Bhutan',
  'Every meal, and a cup of tea or coffee with it',
  'Accommodation in family-run hotels',
  'Your guide’s transport, food, lodging and insurance',
  'A down jacket, all-season sleeping bag and duffel bag, on loan',
  'A first-aid kit, carried by the guide',
  'All permits and paperwork within Bhutan',
]

const SHARED_EXCLUDED = [
  'International airfare',
  'Visa charges',
  'Travel and medical insurance',
  'Personal expenses: shopping, bar bills, laundry, telephone',
  'Anything not named in the itinerary',
  'Emergency costs such as a chartered helicopter',
]

const SHARED_FAQ = [
  {
    question: 'Why Bhutan?',
    answer:
      'It is the only carbon-negative country in the world, and it measures progress in Gross National Happiness. The dzongs, temples and festivals are not exhibits. They are in use.',
  },
  {
    question: 'Who guides us?',
    answer:
      'A licensed Bhutanese guide throughout, and, on the meditation journeys, teaching from Rinpoches and Lams at the monasteries we visit.',
  },
  {
    question: 'When is best?',
    answer:
      'Spring and autumn for clear skies and festivals. Winter for the cranes in Phobjikha. Summer is green and quiet.',
  },
  {
    question: 'What is the SDF?',
    answer:
      'The Sustainable Development Fee, US$100 per person per night, paid to the Royal Government of Bhutan. It is included in our price.',
  },
  {
    question: 'Can we change the pace?',
    answer:
      'Yes. Departures are small and few, so the days bend to the group. Tell us what you are hoping for.',
  },
]

const GALLERY: Trip['gallery'] = [
  [IMG.chorten, '1/1', '28vw'],
  [IMG.bridge, '16/10', '42vw'],
  [IMG.dzong, '3/4', '26vw'],
  [IMG.hike, '16/10', '42vw'],
  [IMG.dress, '3/4', '26vw'],
  [IMG.tashichho, '1/1', '28vw'],
]

export const TRIPS: Trip[] = [
  {
    slug: 'valleys',
    title: 'A mindfulness journey through Bhutan’s sacred valleys',
    excerpt:
      'Temples of Paro, the valleys of Bumthang, Trongsa Dzong, Phobjikha, and the walk up to Taktsang.',
    type: 'mindfulness',
    order: 1,
    regions: ['Paro', 'Bumthang', 'Trongsa', 'Phobjikha', 'Punakha'],
    durationDays: 11,
    nights: 10,
    highPointMetres: 3120,
    difficulty: 'Moderate',
    priceFromUsd: 4500,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: 'Spring · Autumn',
    paceNote: 'One rest day',
    journeyLabel: 'Mindfulness journey',
    heroImage: IMG.dzong,
    overview: [
      'Cultural immersion and time in living monasteries, with mindfulness of feeling and sensation practised on every drive, so the journey itself becomes meditation in motion.',
      'We move slowly. Two nights in most valleys, drives of no more than five hours, and a rest day written in at Phobjikha. Your guide is Bhutanese and licensed; at the monasteries, resident Lams lead the sitting.',
      'Thirty percent of what you pay supports Osel Ling Perila Goenpa, a monastery in the hills above Paro.',
    ],
    highlights: [
      'Kichu and Dungtse Lhakhang in Paro, two of the oldest temples in the country',
      'Jakar Dzong and the sacred sites of Bumthang, with evening prayers at Kharchu',
      'Tharpaling Monastery at 3,600 m, and time to sit with the monks',
      'The still valley of Phobjikha, walked slowly on a rest day',
      'Punakha Dzong at the meeting of two rivers',
      'The walk to Taktsang, through pine forest, to the temple on the cliff',
      'Mindfulness of feeling and sensation practised on every drive',
    ],
    itinerary: [
      {
        title: 'Arrive in Paro',
        meta: '2,200 m',
        body: 'Dungtse Lhakhang, a rare triangular temple with fine murals, then Kichu Lhakhang, one of the oldest in the country. The rest of the day is for the mountain air.',
      },
      {
        title: 'Fly to Bumthang',
        meta: '2,600 m',
        body: 'A short domestic flight into the spiritual heartland. Jakar Dzong, the Castle of the White Bird, sits on its ridge above the valley.',
      },
      {
        title: 'Bumthang, the sacred sites',
        meta: 'Full day',
        body: 'Membar Tso, the burning lake. Tamshing and Kurje Lhakhang. Jampa Lhakhang, dedicated to the Buddha of Wisdom. Evening prayers at Kharchu Monastery.',
      },
      {
        title: 'Tharpaling Monastery',
        meta: '3,600 m',
        body: 'A quiet drive up to Tharpaling. Prayer halls, murals, and monks at their daily rituals. Time to sit.',
      },
      {
        title: 'Bumthang to Trongsa',
        meta: 'Drive · 4 h',
        body: 'Rolling hills and small villages. Trongsa Dzong, the historic gateway to central Bhutan, with its courtyards, temples and woodwork.',
      },
      {
        title: 'Trongsa to Phobjikha',
        meta: 'Drive · 4 h',
        body: 'Gangtey Monastery and Drechakling. A first walk in the broad, still valley, wintering ground of the black-necked cranes.',
      },
      {
        rest: true,
        title: 'Phobjikha, on foot',
        body: 'A gentle day on the valley trails: meadows, pine forest, farmsteads. Pause where you like. Meditate, photograph, or do nothing.',
      },
      {
        day: 8,
        title: 'Phobjikha to Punakha',
        meta: 'Drive · 3 h',
        body: 'Punakha Dzong at the meeting of the Pho Chhu and Mo Chhu rivers. Chimi Lhakhang in the afternoon. A river walk at dusk.',
      },
      {
        day: 9,
        title: 'Punakha to Paro, via Thimphu',
        meta: 'Drive · 5 h',
        body: 'Tashichho Dzong and Buddha Dordenma above the capital. On to Paro for a calm evening before the climb.',
      },
      {
        day: 10,
        title: 'Taktsang',
        meta: '3,120 m · 5 h',
        body: 'The walk to Tiger’s Nest through pine forest and past small waterfalls. Prayer halls and relics on the cliff. The descent by the same path.',
      },
      {
        day: 11,
        title: 'Depart Paro',
        body: 'A slow breakfast, a last look at the valley, and the transfer to the airport.',
      },
    ],
    included: SHARED_INCLUDED,
    excluded: SHARED_EXCLUDED,
    faq: [
      {
        question: 'How fit do I need to be?',
        answer:
          'The Taktsang walk is the most demanding day: about five hours with roughly 600 m of ascent. Everything else is gentle. We rest often.',
      },
      ...SHARED_FAQ,
    ],
    gallery: GALLERY,
  },

  {
    slug: 'meditation',
    title: 'Mindful journeys with meditation and Buddhist practice',
    excerpt:
      'Sitting practice in living monasteries, guided by resident Lams, between long quiet drives.',
    type: 'meditation',
    order: 2,
    regions: ['Paro', 'Thimphu', 'Punakha', 'Trongsa', 'Bumthang'],
    durationDays: 10,
    nights: 9,
    highPointMetres: 3400,
    difficulty: 'Demanding',
    priceFromUsd: 4500,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: 'Year round',
    paceNote: 'Daily sitting practice',
    journeyLabel: 'Meditation journey',
    heroImage: IMG.taktshang,
    overview: [
      'A journey built around practice rather than sightseeing. Each day opens with sitting and closes with sitting, and the hours between are held the same way.',
      'Resident Lams lead the sessions in the monasteries we stay near. Nothing is performed for visitors: you join the room as it already is, and the instruction is given plainly.',
      'Thirty percent of what you pay supports Osel Ling Perila Goenpa, a monastery in the hills above Paro.',
    ],
    highlights: [
      'Morning and evening sitting with resident Lams, every day of the journey',
      'Instruction in mindfulness of breathing, feeling and sensation',
      'Kharchu Monastery in Bumthang, and its daily round of prayer',
      'Tharpaling at 3,600 m, where the practice is older than the building',
      'Long, quiet drives held as practice rather than transit',
      'A day of silence in the Punakha valley',
      'The walk to Taktsang, kept for the end',
    ],
    itinerary: [
      {
        title: 'Arrive in Paro',
        meta: '2,200 m',
        body: 'Met at the airport and driven the short distance into the valley. An introduction to the practice we will keep, and a first sitting before dinner.',
      },
      {
        title: 'Paro to Thimphu',
        meta: 'Drive · 1.5 h',
        body: 'Kichu Lhakhang in the morning, then the road to the capital. Buddha Dordenma above the valley in the late afternoon light. Evening sitting.',
      },
      {
        title: 'Thimphu, practice and the dzong',
        meta: 'Full day',
        body: 'A long morning session. Tashichho Dzong when the monks return to it in the afternoon. The rest of the day is unscheduled on purpose.',
      },
      {
        title: 'Thimphu to Punakha',
        meta: 'Dochula · 3,100 m',
        body: 'Over the Dochula pass and its 108 chortens, where we stop and sit if the sky is clear. Down into the warm valley. Punakha Dzong between the two rivers.',
      },
      {
        rest: true,
        title: 'Punakha, a day of silence',
        body: 'One full day held in silence, from waking until the evening session. A river walk, a long sitting, and no talking in between. It is the day most people remember.',
      },
      {
        day: 6,
        title: 'Punakha to Trongsa',
        meta: 'Drive · 5 h',
        body: 'The long drive east, practised as mindfulness of sensation rather than endured. Trongsa Dzong in the evening, the gateway to the centre.',
      },
      {
        day: 7,
        title: 'Trongsa to Bumthang',
        meta: 'Drive · 3 h',
        body: 'Into the spiritual heartland. Evening prayers at Kharchu Monastery, joining the hall rather than watching it.',
      },
      {
        day: 8,
        title: 'Tharpaling and Bumthang',
        meta: '3,400 m',
        body: 'Up to Tharpaling for the day: prayer halls, murals, and a long session with the monks. Kurje and Jampa Lhakhang on the way down.',
      },
      {
        day: 9,
        title: 'Fly to Paro, then Taktsang',
        meta: '3,120 m · 5 h',
        body: 'The morning flight back west, then the climb to Tiger’s Nest through pine forest. The last sitting is on the cliff.',
      },
      {
        day: 10,
        title: 'Depart Paro',
        body: 'A final short session at first light, a slow breakfast, and the transfer to the airport.',
      },
    ],
    included: SHARED_INCLUDED,
    excluded: SHARED_EXCLUDED,
    faq: [
      {
        question: 'Do I need to have meditated before?',
        answer:
          'No. The instruction starts at the beginning and is given plainly. Experienced practitioners are given room to keep their own practice instead.',
      },
      {
        question: 'How demanding is it?',
        answer:
          'Physically it is moderate — the Taktsang walk is the hardest day. The demand is in the schedule: early mornings, long sittings, and a full day of silence.',
      },
      ...SHARED_FAQ,
    ],
    gallery: GALLERY,
  },

  {
    slug: 'festival',
    title: 'Sacred rhythms of Bhutan: a festival and meditation journey',
    excerpt: 'A tshechu in the dzong courtyard, then stillness in the valleys around it.',
    type: 'festival',
    order: 3,
    regions: ['Paro', 'Thimphu', 'Punakha'],
    durationDays: 5,
    nights: 4,
    highPointMetres: 3100,
    difficulty: 'Gentle',
    priceFromUsd: 3000,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: 'Festival-timed',
    paceNote: 'Gentle pace',
    journeyLabel: 'Festival journey',
    heroImage: IMG.tashichho,
    overview: [
      'Five days timed to a tshechu: masked cham dances in a dzong courtyard, the whole valley in its finest kira and gho, and a giant thongdrel unrolled before dawn.',
      'Around the festival we keep the days quiet. A short journey, gently paced, with time to sit in the valleys between.',
      'Departures follow the festival calendar, so dates are fixed by the lunar month rather than by us. Write and we will tell you what is coming.',
    ],
    highlights: [
      'A full day of cham dances in the dzong courtyard',
      'The thongdrel unrolled at dawn, and folded away before the sun reaches it',
      'The valley in national dress, which is worn for the festival, not for visitors',
      'Tashichho Dzong in Thimphu, and Buddha Dordenma above it',
      'Punakha Dzong at the meeting of the Pho Chhu and Mo Chhu',
      'Sitting practice in the quiet valleys either side of the festival',
    ],
    itinerary: [
      {
        title: 'Arrive in Paro',
        meta: '2,200 m',
        body: 'Met at the airport. Kichu Lhakhang, one of the oldest temples in the country, and a slow first evening in the valley.',
      },
      {
        title: 'The tshechu',
        meta: 'Full day',
        body: 'The festival day. Masked cham dances in the dzong courtyard from morning, the atsara clowning between them, and the whole valley gathered. We find shade, and stay as long as you want to.',
      },
      {
        title: 'Thimphu',
        meta: 'Drive · 1.5 h',
        body: 'The road to the capital. Tashichho Dzong in the afternoon, Buddha Dordenma above the valley, and an evening sitting.',
      },
      {
        title: 'Punakha',
        meta: 'Dochula · 3,100 m',
        body: 'Over the Dochula pass and its 108 chortens. Punakha Dzong between the rivers, then Chimi Lhakhang and a walk through the fields to reach it.',
      },
      {
        title: 'Depart Paro',
        meta: 'Drive · 3 h',
        body: 'Back over the pass to Paro, with a stop wherever the light asks for one, and the transfer to the airport.',
      },
    ],
    included: SHARED_INCLUDED,
    excluded: SHARED_EXCLUDED,
    faq: [
      {
        question: 'Which festival will we see?',
        answer:
          'It depends on the month. Paro Tshechu falls in spring, Thimphu Tshechu in mid-September, and there are smaller festivals through the year. Tell us when you can travel and we will match you to one.',
      },
      {
        question: 'Can we photograph the dances?',
        answer:
          'In the courtyard, yes. Inside the temples and during the thongdrel, no. Your guide will say clearly when to put the camera away.',
      },
      ...SHARED_FAQ,
    ],
    gallery: [
      [IMG.tshechu, '16/10', '42vw'],
      [IMG.dress, '3/4', '26vw'],
      [IMG.tashichho, '1/1', '28vw'],
      [IMG.bridge, '16/10', '42vw'],
      [IMG.chorten, '3/4', '26vw'],
    ],
  },

  {
    slug: 'jomolhari',
    title: 'Jomolhari trek: a journey into joyful heights',
    excerpt: 'The classic high route beneath Jomolhari, walked at a pace that leaves room to notice.',
    type: 'trekking',
    order: 4,
    regions: ['Paro', 'Jomolhari'],
    durationDays: 15,
    nights: 14,
    highPointMetres: 4930,
    difficulty: 'Demanding',
    priceFromUsd: 7000,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: 'Autumn',
    paceNote: 'Two rest days',
    journeyLabel: 'Trek',
    heroImage: IMG.hike,
    overview: [
      'The classic high route beneath Jomolhari, 7,326 m, walked slowly enough to acclimatise properly and slowly enough to notice where you are.',
      'Two rest days are written in, at Jangothang and at Lingshi, and the high point is the Nyile La at 4,930 m. Camp is carried and set by our crew; you carry a day pack.',
      'Autumn is the season for it: the monsoon has cleared, the peaks stand sharp, and the nights are cold and dry.',
    ],
    highlights: [
      'Jomolhari, 7,326 m, seen from the camp at its foot',
      'Jangothang base camp, and a rest day to walk up to the lakes above it',
      'The Nyile La at 4,930 m, the high point of the route',
      'Lingshi Dzong on its ridge, and the village below it',
      'Yak herders’ camps, and tea in them if the season is right',
      'Takin and blue sheep on the upper slopes',
      'The walk to Taktsang at the end, which feels gentle by then',
    ],
    itinerary: [
      {
        title: 'Arrive in Paro',
        meta: '2,200 m',
        body: 'Met at the airport. Kichu Lhakhang, and a slow afternoon in the valley to begin adjusting to the altitude.',
      },
      {
        title: 'Paro, and the climb to Taktsang',
        meta: '3,120 m · 5 h',
        body: 'The walk to Tiger’s Nest, taken early as acclimatisation as much as pilgrimage. The rest of the day is for kit checks and rest.',
      },
      {
        title: 'Drukgyel to Shana',
        meta: '2,870 m · 6 h',
        body: 'The trek begins at the ruined dzong at Drukgyel. A gentle day through farmland and pine along the Pa Chhu.',
      },
      {
        title: 'Shana to Soi Thangthangkha',
        meta: '3,610 m · 8 h',
        body: 'A long day up the river valley, the forest closing in and then opening. The first sight of Jomolhari if the cloud lifts.',
      },
      {
        title: 'To Jangothang',
        meta: '4,080 m · 5 h',
        body: 'Above the tree line. Yak pastures, a small army post, and camp beneath the north face of Jomolhari.',
      },
      {
        rest: true,
        title: 'Jangothang',
        body: 'A rest day at base camp. Walk up to Tshophu lakes, or sit and do nothing at all. Either is acclimatisation.',
      },
      {
        day: 7,
        title: 'Jangothang to Lingshi',
        meta: 'Nyile La · 4,930 m · 8 h',
        body: 'The high point of the route. Up to the Nyile La with Jomolhari, Jichu Drake and Tsherimgang behind you, then the long descent to Lingshi.',
      },
      {
        rest: true,
        title: 'Lingshi',
        body: 'A second rest day. Lingshi Dzong on its ridge, the village below, and time with the people who live up here year round.',
      },
      {
        day: 9,
        title: 'Lingshi to Shodu',
        meta: 'Yale La · 4,820 m · 9 h',
        body: 'Over the Yale La, the last high pass, with the Tibetan border ranges to the north. A long descent into the Thimphu Chhu valley.',
      },
      {
        day: 10,
        title: 'Shodu to Barshong',
        meta: '3,710 m · 6 h',
        body: 'Following the river down through rhododendron and birch, past waterfalls, to the ruins of Barshong Dzong.',
      },
      {
        day: 11,
        title: 'Barshong to Dolam Kencho',
        meta: '3,290 m · 5 h',
        body: 'A shorter day, losing height steadily, the air thickening again with every hour.',
      },
      {
        day: 12,
        title: 'Dolam Kencho to Thimphu',
        meta: '2,320 m · 4 h',
        body: 'The last walking day, out to the road head at Dodina, then the short drive into the capital. A hot shower, and a bed.',
      },
      {
        day: 13,
        title: 'Thimphu',
        meta: 'Full day',
        body: 'Tashichho Dzong and Buddha Dordenma, taken gently. A day to let the legs recover and the trek settle.',
      },
      {
        day: 14,
        title: 'Thimphu to Paro',
        meta: 'Drive · 1.5 h',
        body: 'Back to the valley where it started, with the afternoon free.',
      },
      {
        day: 15,
        title: 'Depart Paro',
        body: 'A slow breakfast, a last look at the mountains, and the transfer to the airport.',
      },
    ],
    included: [
      ...SHARED_INCLUDED,
      'All camping equipment: tents, mats, kitchen and dining shelter',
      'Trek crew, cook, ponies and pony handlers',
    ],
    excluded: SHARED_EXCLUDED,
    faq: [
      {
        question: 'How fit do I need to be?',
        answer:
          'This is the most demanding journey we run. Expect six to nine hours of walking on most days, two passes near 4,900 m, and twelve nights under canvas. You should be walking regularly on hills before you come.',
      },
      {
        question: 'What about altitude?',
        answer:
          'The route is built to acclimatise: two rest days, and height gained gradually. Your guide carries a first-aid kit and watches for symptoms daily. If anyone needs to descend, we descend.',
      },
      {
        question: 'Do we carry our own packs?',
        answer:
          'No. Ponies carry the camp and the main bags. You carry a day pack with water, layers and a camera.',
      },
      ...SHARED_FAQ,
    ],
    gallery: [
      [IMG.hike, '16/10', '44vw'],
      [IMG.taktshang, '3/4', '26vw'],
      [IMG.dzong, '16/10', '42vw'],
      [IMG.chorten, '1/1', '28vw'],
      [IMG.bridge, '16/10', '42vw'],
    ],
  },

  /**
   * Carried over from lotuspeak.org, where it runs as "Bhutan Cultural & Nature
   * Journey – Paro Tshechu Special" (trip code BCNJ, US$ 3,500). The itinerary,
   * price, inclusions and exclusions are the site's own.
   *
   * Its length is recorded inconsistently upstream: the duration field says
   * 5 days / 6 nights, the description says seven days, and the itinerary has
   * seven days in it. Seven days and six nights is what the itinerary
   * describes, so that is what is here — CONFIRM WITH LOTUS PEAK.
   */
  {
    slug: 'tshechu',
    title: 'Paro Tshechu: a cultural and nature journey',
    excerpt:
      'Seven days timed to the Paro festival, then out to Phobjikha for the quiet, and up to Taktsang at the end.',
    type: 'festival',
    order: 5,
    regions: ['Paro', 'Thimphu', 'Phobjikha', 'Punakha'],
    durationDays: 7,
    nights: 6,
    highPointMetres: 3120,
    difficulty: 'Moderate',
    priceFromUsd: 3500,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: 'Timed to Paro Tshechu',
    paceNote: 'Balanced pace',
    journeyLabel: 'Festival journey',
    heroImage: IMG.chamMaskedDance,
    overview: [
      'A week built around the Paro Tshechu, with the festival in the middle of it rather than at the end, so there is time to sit with what you have seen.',
      'Paro and Thimphu first, for the temples, the dzongs and the markets, with short mindfulness practice written into each day. Then the road east over the passes to Punakha and out to Phobjikha, where the valley is open and empty and the walking is level.',
      'The last morning is the climb to Taktsang. It is the hardest thing in the week and it comes when you are ready for it.',
    ],
    highlights: [
      'Paro Tshechu at Rinpung Dzong: cham dances, ritual, and the whole valley in its best kira and gho',
      'Kyichu Lhakhang, one of the oldest temples in the country, on the first afternoon',
      'Ta Dzong, the National Museum, in the old watchtower above the dzong',
      'Buddha Dordenma on the ridge above Thimphu, and the Memorial Chorten below it',
      'The drive to Phobjikha over the passes, and a nature walk on the valley floor',
      'Gangtey Goenpa, and sitting with the chanting if the timing allows',
      'The walk to Taktsang on the last morning, with an early sitting at the top',
    ],
    itinerary: [
      {
        day: 1,
        title: 'Arrive in Paro',
        meta: '2,200 m',
        body: 'Met at the airport and taken to the hotel to rest after the flight. In the afternoon, a short walk through the town and along the river, then Kyichu Lhakhang. Fifteen minutes of sitting practice before dinner, to let the altitude and the journey settle. A hot stone bath if you want one.',
      },
      {
        day: 2,
        title: 'Paro Tshechu',
        meta: 'Rinpung Dzong · full day',
        body: 'The festival, from the morning. Cham dances in the dzong courtyard, the rituals around them, and the crowd, which is most of the valley. Midday among the stalls. The afternoon is yours: stay for the dancing or take a table above the courtyard. A short sitting in the evening for anyone who wants it.',
      },
      {
        day: 3,
        title: 'Paro, then Thimphu',
        meta: '1½ h drive',
        body: 'Rinpung Dzong in the morning without the crowd, then Ta Dzong, the National Museum, in the round watchtower above it. Ten minutes of sitting before the drive. Thimphu in the afternoon: the Memorial Chorten, the market, the handicraft shops. Evening prayers at a local monastery if the timing works.',
      },
      {
        day: 4,
        title: 'Thimphu, then Phobjikha',
        meta: '4–5 h drive',
        body: 'Buddha Dordenma first, for the whole valley laid out below it. Then the road east over Dochula, where the hundred and eight chortens stand on the pass, and down through Wangdue to the glacial valley at Phobjikha. A gentle walk on the valley floor before dark, and the stars afterwards.',
      },
      {
        day: 5,
        title: 'Phobjikha',
        meta: '2,900 m · full day',
        body: 'The nature trail in the morning, with birds — black-necked cranes if you are here in the winter months. Late morning at Gangtey Goenpa, with time to sit while the chanting is going on. Drechagling hermitage in the afternoon, then the valley at your own pace.',
      },
      {
        day: 6,
        title: 'Back to Paro',
        meta: '5–6 h drive',
        body: 'A slow breakfast with the valley in front of you, then the long scenic drive west. Lunch on the way. Dzongdrakha, the cliff temples above the Paro valley, or a farmhouse visit, depending on the day. Farewell dinner in Paro.',
      },
      {
        day: 7,
        title: 'Taktsang, and departure',
        meta: '3,120 m · 4–5 h',
        body: 'Early start for the walk up to Taktsang, through the pine forest and up the stone steps, with a tea break at the viewpoint. Sitting at the top before the day fills up. Down, lunch in Paro, and to the airport.',
      },
    ],
    included: SHARED_INCLUDED,
    excluded: SHARED_EXCLUDED,
    faq: [
      {
        question: 'Are the festival dates fixed?',
        answer:
          'The tshechu follows the lunar calendar, so the dates move each year. Paro Tshechu falls in spring, usually March or April. We set the departure around it and confirm the dates with you before anything is booked.',
      },
      {
        question: 'How hard is the walk to Taktsang?',
        answer:
          'Four to five hours there and back, climbing about 900 m, on a good path with a teahouse halfway. It is the one demanding morning in the week. Ponies go as far as the teahouse. Nobody is left behind, and nobody has to go.',
      },
      {
        question: 'Will we see the cranes?',
        answer:
          'Only in winter. The black-necked cranes are in Phobjikha from late October to February. Paro Tshechu is in spring, so on this journey the valley is green rather than full of cranes.',
      },
      ...SHARED_FAQ,
    ],
    gallery: [
      [IMG.chamMaskedDance, '16/10', '44vw'],
      [IMG.atsara, '3/4', '26vw'],
      [IMG.paroDzong, '4/3', '32vw'],
      [IMG.phobjikhaValley, '16/10', '42vw'],
      [IMG.gangteyGoenpa, '3/4', '26vw'],
      [IMG.taktshang, '16/10', '42vw'],
    ],
  },
]
