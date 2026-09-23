import { IMG } from '@/lib/assets'
import type {
  Activity,
  CultureArticle,
  Destination,
  GalleryImage,
  Reflection,
  Season,
  SiteSettings,
} from '../types'
import { fillCopyright } from '../types'

/**
 * The valleys, as this folder writes them: one paragraph each.
 *
 * The file provider splits `detail` into a standfirst and the start of a body
 * exactly as the migration `20260923090000_where_we_go_culture_and_journal`
 * split the database's, and adds the places — see `where-we-go.ts` — so both
 * providers hand out the same pages.
 */
export type SeedDestination = Pick<
  Destination,
  'slug' | 'name' | 'icon' | 'blurb' | 'image' | 'tripSlugs' | 'order'
> & { detail: string }

/** A culture piece as this folder writes it: one paragraph, and where to see it. */
export type SeedCulture = Pick<CultureArticle, 'slug' | 'title' | 'icon' | 'image' | 'order'> & {
  body: string
  /** Destination slugs. */
  destinations: string[]
}

export const DESTINATIONS: SeedDestination[] = [
  {
    slug: 'paro',
    name: 'Paro',
    icon: 'taktsang',
    blurb: 'Taktsang, Kichu and Dungtse Lhakhang',
    detail:
      'The valley you arrive in, and the only one with an airport. Rinpung Dzong stands over the town with the old watchtower above it, now the National Museum. Kyichu Lhakhang is one of the oldest temples in the country. Taktsang is a morning’s walk up the cliff at the head of the valley.',
    image: IMG.paroDzong,
    tripSlugs: ['tshechu', 'valleys', 'meditation', 'jomolhari'],
    order: 1,
  },
  {
    slug: 'thimphu',
    name: 'Thimphu',
    icon: 'buddha',
    blurb: 'Buddha Dordenma and Tashichho Dzong',
    detail:
      'The capital, at 2,320 m along the Wang Chhu. Tashichho Dzong is still the seat of government. Buddha Dordenma sits gilded on the ridge to the south, the Memorial Chorten is circled from dawn to dusk, and Simtokha, the oldest dzong in the country, is five kilometres down the road.',
    image: IMG.thimphuDzong,
    tripSlugs: ['tshechu', 'meditation', 'festival'],
    order: 2,
  },
  {
    slug: 'punakha',
    name: 'Punakha',
    icon: 'punakha',
    blurb: 'The dzong between two rivers',
    detail:
      'Warm, low and green, an hour beyond Dochula. The dzong stands where the Pho Chhu and Mo Chhu meet and is reached by a roofed cantilever bridge. Every king of Bhutan has been crowned in it, and the monk body moves down here for the winter.',
    image: IMG.dzong,
    tripSlugs: ['valleys', 'meditation', 'festival', 'tshechu'],
    order: 3,
  },
  {
    slug: 'bumthang',
    name: 'Bumthang',
    icon: 'jakar',
    blurb: 'Jakar, Kurjey, Tamshing, Könchogsum',
    detail:
      'Four high valleys in the centre of the country and the spiritual heartland of it. Jakar Dzong above the main valley, Kurjey over Guru Rinpoche’s cave, Pema Lingpa’s unrestored murals at Tamshing, the burning lake in the Tang Chhu, and Tharpaling at 3,600 m.',
    image: IMG.kurjeyLhakhang,
    tripSlugs: ['valleys', 'meditation'],
    order: 4,
  },
  {
    slug: 'trongsa',
    name: 'Trongsa',
    icon: 'chorten',
    blurb: 'The gateway dzong to the centre',
    detail:
      'The largest dzong in the country, strung along a ridge above the Mangde Chhu, and the ancestral seat of the Wangchuck dynasty. For centuries every journey between east and west passed beneath it.',
    image: IMG.trongsaDzong,
    tripSlugs: ['valleys', 'meditation'],
    order: 5,
  },
  {
    slug: 'phobjikha',
    name: 'Phobjikha',
    icon: 'pavilion',
    blurb: 'Gangtey and the black-necked cranes',
    detail:
      'A wide glacial valley at about 2,900 m, with no trees on its floor and very little on it at all. Gangtey Goenpa sits above the village at the head of it. The black-necked cranes winter here, from late October to February.',
    image: IMG.phobjikhaValley,
    tripSlugs: ['tshechu', 'valleys'],
    order: 6,
  },
]

/**
 * The three activity groupings the site has always used, from the WordPress
 * taxonomy. They are a way of reading the journeys, not a separate product:
 * every journey contains some of all three, and the counts on the index page
 * come from `tripSlugs` rather than being stored.
 */
export const ACTIVITIES: Activity[] = [
  {
    slug: 'cultural-and-historical',
    name: 'Cultural and historical',
    blurb: 'Dzongs, temples, festivals and the thirteen arts, seen where they are still in use.',
    icon: 'dzong-long',
    image: IMG.chamMaskedDance,
    examples: [
      'Cham dances in a dzong courtyard at a tshechu',
      'Temples from the eighth century onwards, most of them still working',
      'The National Museum in the old watchtower at Paro',
      'Jomzo, weaving and the other of the thirteen arts, watched at the bench',
    ],
    tripSlugs: ['tshechu', 'festival', 'valleys', 'meditation'],
    order: 1,
  },
  {
    slug: 'mindfulness-and-retreat',
    name: 'Mindfulness and retreat',
    blurb: 'Sitting practice each day, and teaching from the Lams and Rinpoches at the monasteries we visit.',
    icon: 'buddha',
    image: IMG.meditation,
    examples: [
      'Short sitting practice written into each day, including the drives',
      'Teaching from resident Lams at Kharchu, Tharpaling and Gangtey',
      'Evening prayers with the monk body, where we are welcome',
      'Silent mornings, for anyone who wants them',
    ],
    tripSlugs: ['meditation', 'valleys', 'tshechu'],
    order: 2,
  },
  {
    slug: 'nature-and-walking',
    name: 'Nature and walking',
    blurb: 'From an afternoon on a valley floor to fifteen days under Jomolhari.',
    icon: 'pavilion',
    image: IMG.jomolhariTrek,
    examples: [
      'The climb to Taktsang, 900 m up and back in a morning',
      'The Phobjikha nature trail, level, and the cranes in winter',
      'The Jomolhari route, with two rest days and a pass at 4,930 m',
      'Blue sheep, takin, and yak camps on the high ground',
    ],
    tripSlugs: ['jomolhari', 'valleys', 'tshechu'],
    order: 3,
  },
]

/**
 * The gallery, curated down from the 109 files in the WordPress media library.
 * Theme furniture, backgrounds, logos and profile pictures are left out; what
 * is here is photographs of Bhutan with a caption written from the photograph.
 */
export const GALLERY: GalleryImage[] = [
  { src: IMG.chamMaskedDance, caption: 'Cham, Paro Tshechu', ratio: '3/2', order: 1 },
  { src: IMG.taktshang, caption: 'Taktsang, above the Paro valley', ratio: '3/2', order: 2 },
  { src: IMG.thangkas, caption: 'Thangkas and silks, market stall', ratio: '2/3', order: 3 },
  { src: IMG.dochulaPass, caption: 'The 108 chortens at Dochula', ratio: '3/2', order: 4 },
  { src: IMG.atsara, caption: 'An atsara and a young monk', ratio: '2/3', order: 5 },
  { src: IMG.phobjikhaValley, caption: 'The Phobjikha valley', ratio: '4/3', order: 6 },
  { src: IMG.jomzo, caption: 'Jomzo: clay, and a Lam watching', ratio: '3/4', order: 7 },
  { src: IMG.thimphuDzong, caption: 'Tashichho Dzong, across the rice', ratio: '3/2', order: 8 },
  { src: IMG.maskDance, caption: 'A wrathful mask, mid-step', ratio: '3/4', order: 9 },
  { src: IMG.gelongs, caption: 'The gallery at Punakha Dzong', ratio: '3/2', order: 10 },
  { src: IMG.paroDzong, caption: 'Rinpung Dzong under fresh snow', ratio: '4/3', order: 11 },
  { src: IMG.archery, caption: 'Archery, the arrow away', ratio: '3/2', order: 12 },
  { src: IMG.gangteyGoenpa, caption: 'Gangtey Goenpa under low cloud', ratio: '4/3', order: 13 },
  { src: IMG.recitation, caption: 'Morning recitation', ratio: '16/9', order: 14 },
  { src: IMG.thimphuValley, caption: 'Thimphu, through the flags', ratio: '3/2', order: 15 },
  { src: IMG.chamDancers, caption: 'Waiting to dance', ratio: '3/2', order: 16 },
  { src: IMG.cuisine, caption: 'Red rice, curries and ezay', ratio: '3/2', order: 17 },
  { src: IMG.kurjeyLhakhang, caption: 'Kurjey Lhakhang, Bumthang', ratio: '4/3', order: 18 },
  { src: IMG.khuru, caption: 'Khuru darts', ratio: '2/3', order: 19 },
  { src: IMG.tharpaling, caption: 'Tharpaling, against the rock', ratio: '3/2', order: 20 },
  { src: IMG.khadar, caption: 'A khadar carried to the ceremony', ratio: '4/3', order: 21 },
  { src: IMG.foggyValley, caption: 'Frost, and the valley waking', ratio: '3/2', order: 22 },
  { src: IMG.bellAndDrum, caption: 'Bowls and drum, set out', ratio: '3/2', order: 23 },
  { src: IMG.chimiLhakhang, caption: 'Chimi Lhakhang, Punakha', ratio: '4/3', order: 24 },
  { src: IMG.peace, caption: 'Above the cloud, doing nothing', ratio: '3/4', order: 25 },
  { src: IMG.trongsaDzong, caption: 'Trongsa, ridge behind ridge', ratio: '3/2', order: 26 },
  { src: IMG.rainbow, caption: 'A rainbow over the village', ratio: '3/4', order: 27 },
  { src: IMG.paroAirport, caption: 'Paro, from above the runway', ratio: '16/9', order: 28 },
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

export const CULTURE: SeedCulture[] = [
  {
    slug: 'tshechu',
    title: 'Tshechu',
    body: 'Annual festivals held in dzong courtyards on the tenth day of a lunar month, honouring Guru Rinpoche. Masked cham dances, a giant thongdrel unrolled at dawn, and the whole valley in its finest dress. Paro Tshechu falls in spring, Thimphu Tshechu in September.',
    icon: 'chorten',
    image: IMG.chamMaskedDance,
    order: 1,
    destinations: ['paro', 'thimphu'],
  },
  {
    slug: 'dzongs',
    title: 'Dzongs',
    body: 'Fortress-monasteries that hold both the district administration and the monastic body. Whitewashed walls, a central utse tower, and windows framed in painted timber.',
    icon: 'dzong-long',
    image: IMG.tashichho,
    order: 2,
    destinations: ['punakha-dzong', 'trongsa-dzong'],
  },
  {
    slug: 'textiles',
    title: 'Textiles',
    body: 'Weaving is one of the thirteen traditional arts. A kera, the woven belt that fastens the kira, carries patterns particular to its valley and its weaver.',
    icon: 'pavilion',
    image: IMG.kera,
    order: 3,
    destinations: [],
  },
  {
    slug: 'jomzo',
    title: 'Jomzo and the crafts',
    body: 'Zorig Chusum, the thirteen arts: painting, sculpture, casting, woodwork, weaving and more. Jomzo shapes clay, copper and gold into sacred images, and the workshops are open — you can stand at the bench and watch a figure come up out of the clay.',
    icon: 'buddha',
    image: IMG.jomzo,
    order: 4,
    destinations: [],
  },
  {
    slug: 'gross-national-happiness',
    title: 'Gross National Happiness',
    body: 'Bhutan measures progress by well-being, culture, environment and good governance rather than output alone. It is the only carbon-negative country in the world, and the constitution requires that sixty per cent of it stay under forest.',
    icon: 'monastery',
    image: IMG.rainbow,
    order: 5,
    destinations: [],
  },
  {
    slug: 'kira-and-gho',
    title: 'Kira and gho',
    body: 'National dress worn daily: the kira for women, the gho for men, with a kabney or rachu scarf added inside dzongs and temples.',
    icon: 'stupa',
    image: IMG.dress,
    order: 6,
    destinations: [],
  },
  {
    slug: 'archery',
    title: 'Archery and khuru',
    body: 'Datse is the national sport and it is played everywhere, over 145 m, with singing and dancing from the team at the far end when a shot lands. Khuru is its winter cousin: weighted darts thrown twenty metres at a small board.',
    icon: 'pavilion',
    image: IMG.archery,
    order: 7,
    destinations: [],
  },
  {
    slug: 'food',
    title: 'At the table',
    body: 'Red rice, and chilli treated as a vegetable rather than a spice. Ema datshi — chillies and cheese — is the national dish. Every meal on our journeys is included, and there is always something mild alongside.',
    icon: 'chorten',
    image: IMG.cuisine,
    order: 8,
    destinations: [],
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
    { label: 'Where we go', href: '/destinations' },
    { label: 'Culture', href: '/culture' },
    { label: 'Journal', href: '/journal' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  navCta: { label: 'Explore trips', href: '/trips' },
  footer: {
    columns: [
      {
        title: 'Journeys',
        links: [
          { label: 'Our trips', href: '/trips' },
          { label: 'Paro Tshechu', href: '/trips/tshechu' },
          { label: 'Sacred valleys', href: '/trips/valleys' },
          { label: 'Jomolhari trek', href: '/trips/jomolhari' },
          { label: 'What you can do', href: '/activities' },
        ],
      },
      {
        title: 'Bhutan',
        links: [
          { label: 'Where we go', href: '/destinations' },
          { label: 'Culture & traditions', href: '/culture' },
          { label: 'Journal', href: '/journal' },
          { label: 'Gallery', href: '/gallery' },
          { label: 'When to come', href: '/#seasons' },
        ],
      },
      {
        title: 'Practical',
        links: [
          { label: 'Enquiry form', href: '/contact' },
          { label: 'Travellers’ information', href: '/travellers-information' },
          { label: 'About Lotus Peak', href: '/about' },
          { label: 'Terms & conditions', href: '/terms' },
        ],
      },
    ],
    note: 'A small Bhutanese company. Journeys led slowly, with monks and Lams, and time written in to do nothing.',
    copyright: fillCopyright('© {year} {name}', 'Lotus Peak'),
    credit: { label: 'Website by', name: 'Trailma', url: 'https://trailma.com' },
    show: { links: true, address: true, contacts: true, socials: true },
  },
  address: { lines: ['Thimphu, Bhutan'], mapUrl: null },
  contacts: [
    { kind: 'phone', label: 'Telephone', display: '+975 17984485', href: 'tel:+97517984485' },
    { kind: 'email', label: 'Email', display: 'info@lotuspeak.org', href: 'mailto:info@lotuspeak.org' },
  ],
  socials: [
    {
      platform: 'FACEBOOK',
      label: 'Lotus Peak Tours & Travel',
      url: 'https://www.facebook.com/profile.php?id=61588546391091',
    },
  ],
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
