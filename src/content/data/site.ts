import { IMG } from '@/lib/assets'
import type { CultureArticle, Destination, Reflection, Season, SiteSettings } from '../types'

export const DESTINATIONS: Destination[] = [
  { slug: 'paro', name: 'Paro', icon: 'dzong', blurb: 'Taktsang, Kichu and Dungtse Lhakhang', order: 1 },
  { slug: 'thimphu', name: 'Thimphu', icon: 'buddha', blurb: 'Buddha Dordenma and Tashichho Dzong', order: 2 },
  { slug: 'punakha', name: 'Punakha', icon: 'dzong-long', blurb: 'The dzong between two rivers', order: 3 },
  { slug: 'bumthang', name: 'Bumthang', icon: 'monastery', blurb: 'Jakar, Kurje, Tamshing, Jampa', order: 4 },
  { slug: 'trongsa', name: 'Trongsa', icon: 'chorten', blurb: 'The gateway dzong to the centre', order: 5 },
  { slug: 'phobjikha', name: 'Phobjikha', icon: 'pavilion', blurb: 'Gangtey and the black-necked cranes', order: 6 },
]

export const SEASONS: Season[] = [
  {
    key: 'spring',
    monthsLabel: 'Mar – May',
    name: 'Spring',
    headline: 'Clear skies and festivals',
    summary:
      'Rhododendrons in the forests above Paro. Tshechus in the dzong courtyards. The high passes open again.',
    detail:
      'Spring arrives in early March and the valleys warm quickly, from around 6 °C at midday at the start of the season to 15–20 °C by May. Nights stay cool, near freezing in March and around 9 °C by May. The mountains hold their snow until late spring, and rain builds slowly, from four wet days in March to nine in May. Paro Tshechu falls in this window, as do Shabdrung Kuchoe in late April and Lord Buddha’s Parinirvana at the end of May.',
    image: IMG.springImg,
    order: 1,
  },
  {
    key: 'summer',
    monthsLabel: 'Jun – Aug',
    name: 'Summer',
    headline: 'Green and quiet',
    summary: 'The monsoon softens everything. Valleys are at their greenest and the trails are ours alone.',
    detail:
      'The monsoon runs from June to August. In the central valleys days sit at 21–22 °C and nights around 13–14 °C, with rain on most days and July the wettest month. The south is hot and humid; the high country stays cool. Rice terraces are at their greenest, rivers run full, and the trails are almost empty. The birth anniversary of Guru Rinpoche in late June and the First Sermon of Lord Buddha in mid-July are the season’s observances.',
    image: IMG.summerImg,
    order: 2,
  },
  {
    key: 'autumn',
    monthsLabel: 'Sep – Nov',
    name: 'Autumn',
    headline: 'The clearest light',
    summary: 'Harvest in the fields, Jomolhari sharp against the sky. The season for the long walk.',
    detail:
      'September still carries the tail of the monsoon, then the sky clears. October brings 19 °C days, cold 7 °C nights and only a handful of wet days; November is drier still, with almost no rain and nights near freezing. The high peaks stand sharp against blue sky, which makes this the season for Jomolhari. Thimphu Tshechu in mid-September, Blessed Rainy Day, the Descending Day of Lord Buddha and National Day preparations fill the calendar.',
    image: IMG.autumnImg,
    order: 3,
  },
  {
    key: 'winter',
    monthsLabel: 'Dec – Feb',
    name: 'Winter',
    headline: 'The cranes return',
    summary: 'Black-necked cranes winter in Phobjikha. Cold mornings, still air, and empty temples.',
    detail:
      'Winter is sunny and dry. Days reach 11–12 °C in the western valleys, nights fall to around -2 °C, and rain is rare. Snow closes stretches of the east–west highway, so this is the time for Paro, Thimphu, Punakha, Wangdue and Haa. Black-necked cranes settle in Phobjikha, and the temples are quiet. National Day on 17 December, Nyilo at the solstice, the Traditional Day of Offering in January and Losar in February mark the season.',
    image: IMG.winterImg,
    order: 4,
  },
]

export const CULTURE: CultureArticle[] = [
  {
    slug: 'tshechu',
    title: 'Tshechu',
    body: 'Annual festivals held in dzong courtyards on the tenth day of a lunar month, honouring Guru Rinpoche. Masked cham dances, a giant thongdrel unrolled at dawn, and the whole valley in its finest dress.',
    icon: 'chorten',
    image: IMG.dress,
    order: 1,
  },
  {
    slug: 'dzongs',
    title: 'Dzongs',
    body: 'Fortress-monasteries that hold both the district administration and the monastic body. Whitewashed walls, a central utse tower, and windows framed in painted timber.',
    icon: 'dzong-long',
    image: IMG.tashichho,
    order: 2,
  },
  {
    slug: 'textiles',
    title: 'Textiles',
    body: 'Weaving is one of the thirteen traditional arts. A kera, the woven belt that fastens the kira, carries patterns particular to its valley and its weaver.',
    icon: 'pavilion',
    image: IMG.kera,
    order: 3,
  },
  {
    slug: 'jomzo',
    title: 'Jomzo and the crafts',
    body: 'Zorig Chusum, the thirteen arts: painting, sculpture, casting, woodwork, weaving and more. Jomzo shapes clay, copper and gold into sacred images.',
    icon: 'buddha',
    image: IMG.dragon,
    order: 4,
  },
  {
    slug: 'gross-national-happiness',
    title: 'Gross National Happiness',
    body: 'Bhutan measures progress by well-being, culture, environment and good governance rather than output alone. It is the only carbon-negative country.',
    icon: 'monastery',
    image: IMG.bridge,
    order: 5,
  },
  {
    slug: 'kira-and-gho',
    title: 'Kira and gho',
    body: 'National dress worn daily: the kira for women, the gho for men, with a kabney or rachu scarf added inside dzongs and temples.',
    icon: 'stupa',
    image: IMG.dress,
    order: 6,
  },
]

export const REFLECTIONS: Reflection[] = [
  {
    id: 'penjor-bumthang',
    quote:
      'More than a tour. Every moment felt intentional. From the monasteries to the valleys, I felt connected to Bhutan and to my own quiet.',
    name: 'Penjor',
    detail: 'Bumthang, 2026',
    featured: true,
    order: 1,
  },
  {
    id: 'traveller-valleys',
    quote:
      'Our Lam stopped us on the pass and we sat for twenty minutes. Nothing was said. It is the part I remember.',
    name: 'A traveller',
    detail: 'Sacred valleys, spring 2026',
    tripSlug: 'valleys',
    featured: true,
    order: 2,
  },
  {
    id: 'penjor-about',
    quote:
      'Traveling with Lotus Peak was more than a tour. It was a life-changing experience. Every moment felt intentional and deeply meaningful.',
    name: 'Penjor',
    detail: 'Bumthang, 2026',
    featured: false,
    order: 3,
  },
]

export const SETTINGS: SiteSettings = {
  brand: 'Lotus Peak',
  line: 'Small-group journeys in Bhutan.',
  nav: [
    { label: 'Our trips', href: '/trips' },
    { label: 'About', href: '/about' },
    { label: 'Culture', href: '/culture' },
    { label: 'Contact', href: '/contact' },
  ],
  navCta: { label: 'Explore trips', href: '/trips' },
  footer: {
    // Only routes that exist. The prototype's footer links to a blog, a gallery,
    // travellers' information and terms — none of which are built yet, and two of
    // which its router silently redirected elsewhere (audit, /trips spec §nav).
    columns: [
      {
        title: 'Journeys',
        links: [
          { label: 'Our trips', href: '/trips' },
          { label: 'Sacred valleys', href: '/trips/valleys' },
          { label: 'Jomolhari trek', href: '/trips/jomolhari' },
        ],
      },
      {
        title: 'Inner journey',
        links: [
          { label: 'Culture & traditions', href: '/culture' },
          { label: 'About Lotus Peak', href: '/about' },
          { label: 'Meditation journeys', href: '/trips?type=Meditation' },
        ],
      },
      {
        title: 'Practical',
        links: [
          { label: 'Enquiry form', href: '/contact' },
          { label: 'When to come', href: '/#seasons' },
          { label: 'Where we go', href: '/#destinations' },
        ],
      },
    ],
    note: 'Lotus Peak Tours & Travel · Thimphu, Bhutan · +975 17984485',
  },
  contact: {
    phone: '+975 17984485',
    email: 'info@lotuspeak.org',
    replyPromise: 'Personally, within two days',
  },
  pledge: { percent: 30, beneficiary: 'Osel Ling Perila Goenpa' },
  sdfPerNightUsd: 100,
  defaultSeo: {
    title: 'Lotus Peak',
    description:
      'Mindful journeys through Bhutan, led slowly, with monks and Lams, and days written in for doing nothing.',
  },
}
