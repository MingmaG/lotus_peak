import { IMG } from '@/lib/assets'
import type { Post } from '../types'

/**
 * The journal.
 *
 * Carried over from lotuspeak.org, where these five entries live as WordPress
 * posts. The facts are the site's own — dates, fees, opening hours, the 2026
 * monument guidelines — and are kept verbatim. The prose is rewritten into the
 * register of the rest of the site: short sentences, no superlatives.
 *
 * Two photographs were reassigned. The Trongsa entry was illustrated with
 * Simtokha Dzong, which is a different building four hours away, and the
 * Thimphu entry had no lead image at all.
 *
 * Fees and opening hours change. They are dated in the copy so a reader can see
 * how old they are, and they need a check each season.
 */
export const POSTS: Post[] = [
  {
    slug: 'taktsang',
    title: 'Taktsang',
    standfirst:
      'The temple on the cliff above Paro, how it came to be there, and what the walk up is actually like.',
    date: '2025-07-22',
    region: 'Paro',
    heroImage: IMG.taktshang,
    order: 1,
    body: [
      {
        kind: 'text',
        body: 'Taktsang stands on the granite face above the Paro valley, nine hundred metres above the floor of it. Most people know it as the Tiger’s Nest. It is the most photographed building in Bhutan and, for Bhutanese, one of the places you go at least once.',
      },
      {
        kind: 'text',
        body: 'The story begins in the eighth century. Guru Padmasambhava, who brought Vajrayana Buddhism to Bhutan, is said to have flown to this cliff on the back of a tigress, subdued the spirits that held the valley, and meditated in a cave here for three months. The cave is still there, inside the temple. That is what the building is for: everything else is built around it.',
      },
      { kind: 'heading', text: 'Fire, and rebuilding' },
      {
        kind: 'text',
        body: 'Taktsang has burned more than once. The fire of 1998 took most of the main structures. Rebuilding it was treated as a national undertaking rather than a restoration project, and the craftsmen worked to the original detail. What you walk into now is twenty-odd years old and eight hundred years faithful.',
      },
      {
        kind: 'quote',
        text: 'The path climbs through pine forest hung with prayer flags. There is a teahouse at the viewpoint, and it is the first place the monastery comes into sight properly, across the gorge, apparently unsupported.',
      },
      {
        kind: 'text',
        body: 'From the viewpoint the path drops to a waterfall and climbs again by stone steps. Allow four to five hours for the round trip and take it slowly; the altitude does more than the distance. Ponies go as far as the teahouse and no further.',
      },
      { kind: 'image', src: IMG.uphill, ratio: '3/2' },
      {
        kind: 'text',
        body: 'It is a working monastery and a pilgrimage site before it is a viewpoint. Photography is not allowed inside, bags are left at the entrance, and the dress code is the same as at any temple: arms and legs covered, hats off.',
      },
    ],
  },

  {
    slug: 'thimphu',
    title: 'Thimphu',
    standfirst:
      'The capital: a dzong that is still the seat of government, a gilded Buddha on the ridge, and the pass on the road east.',
    date: '2025-07-14',
    region: 'Thimphu',
    heroImage: IMG.thimphuDzong,
    order: 2,
    body: [
      {
        kind: 'text',
        body: 'Thimphu sits along the Wang Chhu at about 2,320 m, with something near 120,000 people in it. It became the capital in the 1960s, under the third King, when it was still largely a village. It has grown quickly since, and it has done so with the traditional window and roof forms intact, which is a policy rather than an accident.',
      },
      {
        kind: 'text',
        body: 'Tashichho Dzong stands at the north end of the city. It holds the throne room, the secretariat and the offices of the ministries, and the central monastic body moves into it for the summer. It is lit at night and visitors can go in after office hours.',
      },
      { kind: 'heading', text: 'Buddha Dordenma' },
      { kind: 'image', src: IMG.buddhaDordenma, ratio: '16/6' },
      {
        kind: 'text',
        body: 'The statue on the ridge at Kuenselphodrang is 51 m of bronze, gilded, seated above the southern approach to the valley. It was finished in 2015 for the sixtieth birthday of the fourth King, and it fulfils a prophecy eight centuries old. Inside are 125,000 smaller Buddhas — a hundred thousand of them eight inches high, twenty-five thousand of them twelve.',
      },
      {
        kind: 'facts',
        title: 'Buddha Dordenma, 2026',
        rows: [
          ['Entry', 'US$ 15 adults, US$ 8 under 18'],
          ['Open', '9:00 – 17:00 daily'],
          ['Also', 'Forest trails run from the car park; one goes down to Changangkha'],
        ],
      },
      { kind: 'heading', text: 'Dochula' },
      {
        kind: 'text',
        body: 'The pass on the road to Punakha, at 3,100 m. A hundred and eight chortens stand on the rise, built in 2004 at the request of the eldest Queen Mother for the soldiers who died in the operation of 2003. They are arranged in three tiers around a central shrine.',
      },
      { kind: 'image', src: IMG.dochulaPass, ratio: '3/2' },
      {
        kind: 'text',
        body: 'On a clear morning the whole eastern Himalaya stands up behind them, Gangkhar Puensum among them at 7,158 m — the highest mountain in the world that nobody has climbed. October to February gives the clearest air. Bring a coat: it is always colder here than in Thimphu, and usually windy. There is a cafeteria, and the tea is hot.',
      },
      { kind: 'heading', text: 'The Memorial Chorten' },
      {
        kind: 'text',
        body: 'Built in 1974 for the third King, and dedicated to world peace. It is the most visible religious building in the city, and the most used. From first light until dusk there are people walking round it clockwise, turning the big red wheels, most of them elderly, most of them there every day. The interior is Nyingma, three storeys of mandalas and wrathful deities. No photographs inside.',
      },
      { kind: 'image', src: IMG.chorten, ratio: '16/9' },
      { kind: 'heading', text: 'Simtokha' },
      {
        kind: 'text',
        body: 'Five kilometres south, on the ridge where the roads to Paro, Punakha and Thimphu meet, stands the oldest dzong in Bhutan still standing in its original form. Zhabdrung Ngawang Namgyal built it in 1629. It was the first to put the monastic body and the administration under one roof, and every dzong built afterwards follows it.',
      },
      { kind: 'image', src: IMG.simtokhaDzong, ratio: '3/2' },
      {
        kind: 'list',
        items: [
          'Over three hundred slate carvings from the seventeenth century are set into the outer wall of the utse',
          'The assembly hall holds some of the oldest murals in the country, and a cosmic mandala on the ceiling',
          'The inner sanctum has a large Sakyamuni flanked by eight bodhisattvas',
          'The goenkhang keeps old weapons, and tiger tails hanging from the pillars',
        ],
      },
      {
        kind: 'text',
        body: 'The name comes from sinmo, a demoness, and do, a stone. The dzong is said to be built over the rock she was pinned beneath.',
      },
      { kind: 'heading', text: 'The takin preserve' },
      { kind: 'image', src: IMG.takinPreserve, ratio: '2/1' },
      {
        kind: 'text',
        body: 'Motithang is a fenced stretch of forest above the town rather than a zoo, and the takin — the national animal — move through it more or less as they please. Science files them with the muskox. The country prefers the account in which the Divine Madman, Drukpa Kunley, ate a cow and a goat for lunch, set the goat’s head on the cow’s bones and told the result to walk.',
      },
      {
        kind: 'text',
        body: 'Go early. They come to the fence in the morning and spend the afternoon in the shade. Sambar and barking deer are in there too. Several hiking trails start at the gate, and the short climb to Sangaygang gives the best view over the valley.',
      },
      {
        kind: 'facts',
        title: 'Entry fees, 2026',
        rows: [
          ['Memorial Chorten', 'US$ 15 adults, US$ 8 under 18 · 6:00 – 18:00'],
          ['Simtokha Dzong', 'Nu 500 adults, half for 6–17, free under 5 · 9:00 – 17:00'],
          ['Takin preserve', 'Nu 500'],
        ],
      },
    ],
  },

  {
    slug: 'punakha-dzong',
    title: 'Punakha Dzong',
    standfirst:
      'The Palace of Great Happiness, between two rivers: where the kings are crowned and the monk body spends the winter.',
    date: '2025-07-14',
    region: 'Punakha',
    heroImage: IMG.dzong,
    order: 3,
    body: [
      {
        kind: 'text',
        body: 'Pungthang Dewa Chhenbi Phodrang, the Palace of Great Happiness. It stands on the spit where the Pho Chhu and the Mo Chhu meet — the male river and the female river — and it is the second oldest and second largest dzong in the country.',
      },
      {
        kind: 'text',
        body: 'Zhabdrung Ngawang Namgyal built it in 1637. It was the capital and the seat of government until 1955, the first King was crowned here in 1907, and every king since has been crowned here too.',
      },
      { kind: 'image', src: IMG.bridge, ratio: '4/3' },
      { kind: 'heading', text: 'What it holds' },
      {
        kind: 'list',
        items: [
          'The winter residence of the Je Khenpo and the central monastic body, who come down from Thimphu each year when the cold arrives',
          'The preserved remains of the Zhabdrung',
          'The Rangjung Kharsapani, a self-created image of Avalokiteshvara',
          'Three courtyards rather than the usual two',
        ],
      },
      { kind: 'image', src: IMG.gelongs, ratio: '16/10' },
      {
        kind: 'text',
        body: 'You cross to it on the Bazam, a roofed cantilever bridge over the Mo Chhu. In spring the jacaranda comes out lilac against the whitewash, which is the picture everyone has seen.',
      },
      {
        kind: 'facts',
        title: 'Visiting, 2026',
        rows: [
          ['Entry', 'Nu 500 adults, Nu 250 for 6–17, free under 6'],
          ['Open', 'June to mid-November, 9:00 – 17:00'],
          ['Open', 'Mid-November to May, 11:00 – 13:00 and 15:00 – 17:00'],
          ['Punakha Tshechu', '27 February – 1 March 2026'],
        ],
      },
      {
        kind: 'text',
        body: 'The tshechu re-enacts the defeat of the Tibetan army in 1639, which is not a metaphor here. Photography is fine in the courtyards and not allowed inside the temples. Long sleeves, long trousers or a skirt, and shoes off at the door.',
      },
    ],
  },

  {
    slug: 'bumthang',
    title: 'Bumthang',
    standfirst:
      'Four high valleys, and the sites in them: Kurjey, Tamshing, Könchogsum, the burning lake, and Tharpaling at 3,600 m.',
    date: '2025-07-07',
    region: 'Bumthang',
    heroImage: IMG.jakarDzong,
    order: 4,
    body: [
      {
        kind: 'text',
        body: 'Bumthang is the spiritual heartland of the country and four valleys at once: Choekhor, Tang, Chumey and Ura. Jakar Dzong, the Castle of the White Bird, sits above the main one. Everything below is within a morning of it.',
      },
      { kind: 'heading', text: 'Kurjey Lhakhang' },
      { kind: 'image', src: IMG.kurjeyLhakhang, ratio: '4/3' },
      {
        kind: 'text',
        body: 'Three temples in a row in the Choekhor valley. The oldest is built over the rock where Guru Rinpoche meditated in the eighth century and left the print of his body. That print is the reason for the rest of it. A short drive or a good walk from Jakar town.',
      },
      { kind: 'heading', text: 'Tamshing Lhakhang' },
      { kind: 'image', src: IMG.tamshingLhakhang, ratio: '16/9' },
      {
        kind: 'text',
        body: 'Across the river from Kurjey. Pema Lingpa, the great treasure revealer, founded it in 1501 and painted the murals himself. They have never been restored, which is rare, and they are sixteenth-century work you can stand in front of.',
      },
      {
        kind: 'text',
        body: 'He also forged the iron chain-mail vest that hangs inside. Pilgrims carry it on their shoulders three times round the inner sanctuary; the tradition holds that it clears what you have done wrong. It is heavy. People do it anyway.',
      },
      { kind: 'heading', text: 'Könchogsum Lhakhang' },
      { kind: 'image', src: IMG.konchogsumLhakhang, ratio: '16/9' },
      {
        kind: 'text',
        body: 'A short walk below Tamshing. Originally eighth or ninth century, rebuilt after the fire of 2010. Inside are three statues, the Buddhas of past, present and future, which are said to have flown here from the east. The cracked bell in the courtyard was said to be audible in Tibet.',
      },
      { kind: 'heading', text: 'Membartsho' },
      {
        kind: 'text',
        body: 'The burning lake: a deep green pool in the Tang Chhu rather than a lake, reached by a half-hour drive from Chamkhar and a five-minute walk down from the road. Pema Lingpa is said to have gone into it holding a lit butter lamp and come out with the terma in his hands and the lamp still burning.',
      },
      { kind: 'heading', text: 'Tharpaling' },
      { kind: 'image', src: IMG.tharpaling, ratio: '3/2' },
      {
        kind: 'text',
        body: 'The Place of Liberation, at 3,600 m. Longchen Rabjam founded it in the fourteenth century and it is still what it was then: a retreat centre, with people in long retreat above it on the hillside. The drive up from Gaytsa is about 22 km of dirt road and takes the better part of an hour. Tharpaling Tshechu falls on 3 March 2026.',
      },
      { kind: 'heading', text: 'Kharchu Dratshang' },
      { kind: 'image', src: IMG.recitation, ratio: '16/9' },
      {
        kind: 'text',
        body: 'On the hill above Jakar town, founded in the 1970s and now a Nyingma seat with more than four hundred monks in it. It keeps the teachings of Namkhai Nyingpo Rinpoche. Evening prayers are worth arranging to be there for, and the view back down over Jakar Dzong is the best in the valley.',
      },
      {
        kind: 'facts',
        title: 'Practical, 2026',
        rows: [
          ['Getting there', 'A 35-minute flight from Paro, or a full day’s drive from Thimphu'],
          ['Entry', 'Nu 500 adults, Nu 250 for 6–17, at most temples'],
        ],
      },
    ],
  },

  {
    slug: 'trongsa-dzong',
    title: 'Trongsa Dzong',
    standfirst:
      'The ancestral seat of the Wangchuck dynasty, strung along a ridge above the Mangde Chhu, holding the road between east and west.',
    date: '2025-07-14',
    region: 'Trongsa',
    heroImage: IMG.trongsaDzong,
    order: 5,
    body: [
      {
        kind: 'text',
        body: 'Chhoekhor Raptentse Dzong, built in 1644, is the largest in the country and the one with the best position. It runs along a steep ridge above the Mangde Chhu, and from the road on the far side of the gorge you see the whole length of it at once, with ridge behind ridge going back into the haze.',
      },
      {
        kind: 'text',
        body: 'For centuries every journey between eastern and western Bhutan passed underneath it, which is the point of where it stands. Whoever held Trongsa held the country’s traffic.',
      },
      { kind: 'heading', text: 'Why it matters' },
      {
        kind: 'list',
        items: [
          'It is the ancestral seat of the Wangchuck dynasty; by tradition the Crown Prince serves as Trongsa Penlop before taking the throne',
          'It houses the second-largest monastic body in the country, about two hundred monks',
          'There are twenty-five temples inside it, and a printing house for religious texts',
          'The buildings, courtyards and corridors follow the contours of the mountain rather than a plan, which is why it reads as a labyrinth',
        ],
      },
      { kind: 'image', src: IMG.courtyard, ratio: '2/3' },
      {
        kind: 'text',
        body: 'New monument guidelines came into effect on 1 January 2026. Formal dress is required — shoulders and knees covered — and photography is restricted in parts of the interior.',
      },
      {
        kind: 'facts',
        title: 'Visiting, 2026',
        rows: [
          ['Entry', 'Nu 500 adults, Nu 250 for 6–17, free under 6'],
          ['Open', '9:00 – 17:00 daily, closed to visitors outside those hours'],
          ['Trongsa Tshechu', 'Five days in December or January, ending with the thongdrel at dawn'],
          ['Getting there', 'About seven hours by road from Thimphu'],
        ],
      },
      {
        kind: 'text',
        body: 'Fees are set nationally and change. March to May and September to November give the clearest skies. If you are walking fit, the Mangdue foot trail brings you in through the western gate, which is how everyone arrived until the road was built.',
      },
    ],
  },
]
