# Where we go, Culture and Journal: sources

The researched content in `apps/admin/prisma/seed-data/destinations.json`,
`culture.json` and `posts.json` was checked against the sources below in
September 2026. Each section lists what was relied on for each page, and what
was deliberately left out because sources disagreed.

Anything that changes (the Sustainable Development Fee, visa fees, monument
entry fees, opening hours, festival dates) is stated on the page "as of 2026".
Recheck it here each season before the pages are edited.

Load or reload this content into a database with:

    npm run content:sections -w @lotuspeak/admin

It touches only these three sections, upserting by slug. It overwrites the
words of the pages it names, so do not run it over edits the office has made
to those same pages since.


### Where we go (A): Paro and Thimphu, sources

Checked 23 September 2026.

### Shared across pages
- Department of Tourism, "Entry fee to Monument sites" (circular, effective 15 March 2023; no later revision found in 2026): https://a.storyblok.com/f/171618/x/7145e413c4/entry-fee-to-monument-sites.pdf . Taktsang Nu 1,000; Kyichu, Changangkha, Memorial Chorten, Tashichho Dzong Nu 500; no fee at Simtokha, Buddha Dordenma, Rinpung Dzong; 50% for ages 6 to 18, free 5 and under.
- BBS, "Department of Tourism revises entry fee to seven monuments": https://www.bbs.bt/news/?p=183069
- SDF US$ 100 until 31 August 2027: BBS https://www.bbs.bt/191098/ ; The Bhutanese https://thebhutanese.bt/sdf-to-be-usd-100-per-day-for-next-4-years/
- Coordinates: Wikipedia geo-coordinates (API) for each article, rounded to 4 decimal places.

### Paro
- Paro International Airport (elevation 2,235 m, VMC and daylight only, few certified pilots): https://en.wikipedia.org/wiki/Paro_International_Airport
- Paro town (2,200 m; coordinates given only to the minute, 27°26'N 89°25'E): https://en.wikipedia.org/wiki/Paro,_Bhutan
- Kyichu Lhakhang (Songtsen Gampo, 659 by tradition, left foot of the demoness, Jowo Jampa): https://en.wikipedia.org/wiki/Kyichu_Lhakhang ; https://treasuryoflives.org/institution/Kyichu-Lhakhang-
- Dungtse Lhakhang (Thangtong Gyalpo; 1421 or 1433): https://en.wikipedia.org/wiki/Jangtsa_Dumtseg_Lhakhang
- Drukgyel Dzong (1649, fire early 1950s, rebuild announced 2016): https://en.wikipedia.org/wiki/Drukgyal_Dzong ; https://www.dailybhutan.com/article/restoration-of-drukgyel-dzong-is-expected-to-be-completed-by-june-2022
- Chele La: https://en.wikipedia.org/wiki/Chelela_Pass
- Paro Tshechu 2026 (29 March to 2 April; BBS report of the final day, 2 April 2026): https://www.facebook.com/bhutanbroadcastingservice/posts/2-april-2026-his-majesty-the-king-graced-the-final-day-of-paro-tshechu-today-the/1585200973277891/ ; lunar dates from https://en.wikipedia.org/wiki/Rinpung_Dzong
- Journeys: trips.json

### Taktsang
- https://en.wikipedia.org/wiki/Paro_Taktsang (3,120 m, about 900 m above the valley, 1692 by Tenzin Rabgye, fire 19 April 1998, restoration 2005 at Nu 135 million, four temples)
- Trail figures (trailhead about 2,600 m, cafeteria about 2,940 m, ponies to the cafeteria): https://undiscovered-destinations.com/blog/tigers-nest-bhutan-hike-guide/ ; https://trekbhutan.com/guides/tigers-nest-hike
- Lockers, no photography inside: https://theworldtravelguy.com/tigers-nest-monastery-bhutan/
- Fee: DoT circular above. Old journal post (2025) reused and corrected.

### Rinpung Dzong
- https://en.wikipedia.org/wiki/Rinpung_Dzong (Hungrel, 1644 foundations, 1646 consecration, Ta Dzong 1649, tentative UNESCO list, tshechu 11th to 15th of 2nd month)
- 1897 earthquake, 1907 fire, Nyamai Zam and the 1969 flood: https://bhutanpilgrimage.com/paro-rinpung-dzong-the-fortress-on-a-heap-of-jewels/ ; https://www.windhorsetours.com/sights/paro-rinpung-dzong
- National Museum hours and fee: https://www.nationalmuseum.gov.bt/visiting-hours-and-admission-fees ; history: https://en.wikipedia.org/wiki/National_Museum_of_Bhutan ; 2011 earthquake and restoration: https://www.moha.gov.bt/?p=3357

### Thimphu
- https://en.wikipedia.org/wiki/Thimphu (declared capital 1961, 2,248 to 2,648 m, population 114,551 in 2017)
- Traffic light episode: https://www.bhutanwiki.org/articles/thimphu-no-traffic-lights
- Centenary Farmers' Market: https://www.drukasia.com/bhutan/thimphu/centenary-farmers-market/
- Folk Heritage Museum (2001): https://en.wikipedia.org/wiki/Folk_Heritage_Museum
- Royal Textile Academy: https://www.rtabhutan.org/inauguration-of-the-royal-textile-academy/
- National Institute for Zorig Chusum (1971): https://nizc.edu.gov.bt/ ; https://www.drukasia.com/bhutan/thimphu/national-institute-for-zorig-chusum/
- Postal Museum and stamps: https://en.wikipedia.org/wiki/Bhutan_Postal_Museum ; https://en.wikipedia.org/wiki/Postage_stamps_and_postal_history_of_Bhutan
- Changangkha Lhakhang: https://en.wikipedia.org/wiki/Changangkha_Lhakhang
- Thimphu Tshechu 2026 (21 to 23 September): https://www.officeholidays.com/holidays/bhutan/thimphu/thimphu-tshechu ; https://bhutan.com.au/wp-content/uploads/2025/02/Tentative_Festival_Dates_2026.pdf

### Tashichho Dzong
- https://en.wikipedia.org/wiki/Tashichho_Dzong (Lhanangpa, 1641, 1772 fire, 1897 earthquake, 1962 rebuild, functions, thirty temples)
- Visiting after office hours and flag ceremony: https://www.drukasia.com/bhutan/thimphu/thimphu-dzong/ ; https://travel2unlimited.com/bhutan-flag-ceremony-at-tashicho-dzong/

### Buddha Dordenma
- https://en.wikipedia.org/wiki/Buddha_Dordenma_statue (2006 to 25 September 2015, 125,000 statues, Sonam Zangpo prophecy, park of 943.4 acres opened 2011)
- Consecration by the Je Khenpo: BBS http://www.bbs.bt/news/?p=53475
- Re-gilding 2026 (BBS, 4 September 2026): https://www.bbs.bt/245944/

### National Memorial Chorten
- https://en.wikipedia.org/wiki/Memorial_Chorten,_Thimphu (1974, Ashi Phuntsho Choden, Thinley Norbu Rinpoche, Dudjom Rinpoche, Jangchub chorten, daily circumambulation)

### Simtokha Dzong
- https://en.wikipedia.org/wiki/Simtokha_Dzong (1629, first dzong, Sangak Zabdhon Phodrang, legend, 300 slate carvings, 2002 renovation)
- Language school: https://en.wikipedia.org/wiki/College_of_Language_and_Culture_Studies_(Bhutan) (moved to Taktse 2011)

### Motithang Takin Preserve
- https://en.wikipedia.org/wiki/Motithang_Takin_Preserve (mini zoo, release, 2004 WWF improvements)
- Takin status and subspecies: IUCN Red List, Budorcas taxicolor (Vulnerable)

### Dochula
- https://en.wikipedia.org/wiki/Dochula_Pass (3,100 m, 45/36/27 layout, June 2004 consecration, Druk Wangyal Lhakhang June 2008, festival 13 December since 2011, Royal Botanical Park)
- Department of Culture and Dzongkhag Development, "Dochula Choeten": https://dcdd.moha.gov.bt/collection/dochula-choeten/
- Gangkhar Puensum: https://en.wikipedia.org/wiki/Gangkhar_Puensum

### Where we go (b): sources

Checked September 2026. "DoC heritage register" means the Department of Culture and Dzongkha Development's heritage sites system, heritagesites.systems.gov.bt/application/viewheritage/{id}.

### Across all pages
- Monument fees 2026: Windhorse Tours fee table (windhorsetours.com/bhutan/bhutan-travel-info/entrance-fees-monuments-bhutan/) and BBS, "Department of Tourism revises entry fee to seven monuments" (bbs.bt/news/?p=183069). The two disagree on Trongsa Dzong, Jakar Dzong and Jambay Lhakhang (BBS lists them as free, Windhorse lists Nu 500), so no figure is given for those. Punakha Dzong and Chimi Lhakhang are Nu 500 in both.
- Coordinates: DoC heritage register (Punakha Dzong, Chimi Lhakhang, Kurjey), cross-checked with OpenStreetMap/Nominatim (Punakha Dzong, Chimi, Kurjey, Tamshing, Trongsa Dzong) and Wikipedia's coordinate data (valleys, Könchogsum). Tharpaling: University of Virginia Places gazetteer (places.kmaps.virginia.edu/features/69953).
- Trip details (drive times, the flight to Bumthang, Tharpaling altitude, rest day at Phobjikha): trips.json.

### Punakha
- Wikipedia: Punakha Dzong (1,200 m elevation, fires, floods, 2011 wedding), Punakha.
- DoC heritage register #1180 (Khamsum Yulley Namgyal Chorten, built by Gyalyum Ashi Tshering Yangdon Wangchuck).
- BBS and Druk Journal on the Zhung Dratshang's winter move and the return on the first day of the fourth month.
- Punakha Drubchen and Tshechu: bhutanpilgrimage.com, tshechu.com 2026 calendar, drukasia.com 2026 calendar (Drubchen 24 to 26 February, Tshechu 27 February to 1 March 2026; the Tshechu was added in 2005).
- Rafting: punakha.gov.bt (Dzongkhag Administration) rafting page, whitewaterguidebook.com.
- 2008 coronation: Wikipedia (Jigme Khesar Namgyel Wangchuck), bhutan-360.com (scarf received in Punakha on 1 November 2008, crowned in Tashichho Dzong on 6 November 2008).

### Punakha Dzong
- DoC heritage register #1163 (founder, 1637 to 1638, carpenter Balip, elephant prophecy, name).
- Wikipedia: Punakha Dzong (Machen in the third courtyard, 180 m length, three courtyards, fires 1750 to 1849, 1897 and 1986, floods 1957, 1960, 1994, restoration completed about 2004, bridge rebuilt 2008).
- Old journal post "Punakha Dzong" (reused: Bazam, jacaranda, three courtyards, Rangjung Kharsapani).

### Chimi Lhakhang
- DoC heritage register #1237 (1499, Ngawang Choegyel, Drukpa Kunley, black chorten, wooden phallus with silver handle, painted phalluses).
- punakha.gov.bt tourism page; Wikipedia: Chimi Lhakhang (20-minute walk from Sopsokha) and Phallus paintings in Bhutan (protection against the evil eye and gossip, possible pre-Buddhist origin).

### Phobjikha
- RSPN, "History of Black-necked Crane Festival" (11 November, first held 1998, at Gangtey Goenpa since 2005, about 300 cranes, largest wintering site in Bhutan).
- RSPN black-necked crane programme pages (late October arrival, mid-February departure).
- Wikipedia: Phobjikha Valley (U-shaped glacial valley, overhead lines not permitted, underground cable, potatoes, Gangtey Nature Trail about 90 minutes to Khewang Lhakhang, Ramsar site of 970 ha from 2 May 2014).
- wangduephodrang.gov.bt crane festival page.

### Gangtey Goenpa
- Wikipedia: Gangteng Monastery (1613, Gyalse Pema Thinley, main seat of the Pema Lingpa tradition, eight large pillars, ninth tulku, consecration 10 October 2008 attended by the fourth King, tshechu 5th to 10th of the eighth month).
- littlebhutan.com, windhorsetours.com (grandson of Pema Lingpa, largest Nyingma monastery in western Bhutan).

### Trongsa and Trongsa Dzong
- DoC heritage register #2005 (founded 1543, construction 1647) and #2003 (Taa Dzong, 1652, Minjur Tenpa, now a museum).
- Wikipedia: Trongsa Dzong, Trongsa (2,120 m, "new village", Lateral Road through the dzong), Penlop of Trongsa, Chogyal Minjur Tempa, Pele La (3,420 m).
- trongsa.gov.bt (Chendebji Chorten: 18th century, Lama Shida, Boudhanath model).
- Austrian Development Agency project pages and Daily Bhutan (Ta Dzong restored 2005 to 2008, opened 2008).
- Old journal post "Trongsa Dzong" (reused: about 200 monks, around 25 temples, printing house, labyrinthine plan).

### Bumthang
- Wikipedia: Bumthang District (four gewogs, crops, yathra), Jakar Dzong, Jampa Lhakhang (659, festival 15th to 19th of the ninth month), Membartsho, Bathpalathang Airport (opened 17 December 2011).
- DoC heritage register #82 (Jampa Lhakhang, 659, Songtsen Gampo) and #101 (Jakar Dzong, Ngagi Wangchuk).
- Lonely Planet and tourbhutan.travel for Jakar Dzong's 1667 rebuilding under Minjur Tempa and the 1897 earthquake.
- The Bhutanese and windhorsetours.com on yathra at Zungney.
- Old journal post "Bumthang" (reused: four valleys, Kharchu, Mebar Tsho short walk from the road).

### Kurjey Lhakhang
- DoC heritage register #125 (full legend, Guru Lhakhang rebuilt 1652 by Minjur Tenpa and extended 2008, Sampa Lhundrup 1900 with a 32-foot Guru statue, Ka Goen Phur Sum sanctified June 1990 by Dilgo Khyentse Rinpoche, cypress).
- Wikipedia: Kurjey Lhakhang (remains of the first three kings).
- Kurjey Tshechu: tshechu.com, tourbhutan.travel (tenth day of the fifth month, 24 June 2026, Guru Tshengye thongdrel).

### Tamshing Lhakhang
- Wikipedia: Tamzhing Monastery (1501, completed 1505, among the earliest paintings, UNESCO tentative list 2012, 11th incarnation Lhalung Sungtrul Rinpoche).
- Rubin Museum Project Himalayan Art essay on Tamshing; bhutan-travel.com (chain mail, three circuits, low upper ceiling).

### Könchogsum Lhakhang
- DoC heritage register #85 (Trisong Detsen and Bamir Thrizer, early ninth century, Pema Lingpa's renovation of 1479, Vairocana and the three Buddhas from Kurtoe, cracked bell offered by a tsomem, fire of February 2010, rebuilt by Lhalung Sungtrul Rinpoche and completed 2014).
- bumthang.gov.bt tourism page (terma recovered by Bonpo Dragtshel in 1039, stone sealing the lake, consecrated November 2014).
- Wikipedia: Könchogsum Lhakhang.

### Tharpaling
- windhorsetours.com (3,600 m, Lorepa, Longchen Rabjam in 1352, college founded 1985, road from Gyetsa, trail from Lamey Goenpa, first King's restoration).
- UVA Places gazetteer (3,682 m, 1353, dratshang and shedra).
- DoC heritage register #44 and #68 (founder Longchen, 14th century; shedra 20th century).
- Wikipedia: Choedrak Monastery (3,800 m, an hour's climb from the road end at Tharpaling).

### Culture: sources

Checked September 2026. Anything that changes (festival dates, SDF, dzong hours) is stated as of 2026 in the copy.

### tshechu
- Kuensel / BBS reports on the Paro Tshechu last day and the Guru Tshengye Thongdrel shown at dawn and folded before sunrise: https://www.bbs.bt/25141/ , https://www.bbs.bt/57814/ , https://kuenselonline.com/news/taksha-silli-receives-new-guru-tshengye-thongdrel
- UNESCO ICH, Mask dance of the drums from Drametse (inscribed 2008, proclaimed 2005): https://ich.unesco.org/en/RL/mask-dance-of-the-drums-from-drametse-00161
- Department of Tourism, festival pages and editorial (Punakha early in the year, Trongsa in December): https://www.bhutan.travel/events/thimphu-tshechu , https://bhutan.travel/journal/editorial/bhutan-s-astounding-festivals
- Atsara (acharya), Kuensel "Why We Do What We Do" series, reprinted by UVA Mandala: https://texts.mandala.library.virginia.edu/book_pubreader/39136
- Dance names (Shana, Durdag, Raksha Mangcham) and thongdrel: Wikipedia "Tshechu" (citing Dobson/UNESCO), cross-checked with tour-operator festival guides.
- Season for Paro (March/April) and Thimphu (September/October) cross-checked against 2026 published calendars (Paro 29 March to 2 April, Thimphu 21 to 23 September 2026). Specific dates deliberately not printed.

### dzongs
- UNESCO tentative list, "Dzongs: the centre of temporal and religious authorities" (Punakha, Wangdue Phodrang, Paro, Trongsa, Dagana), submitted 8 March 2012: https://whc.unesco.org/en/tentativelists/?action=listtentative&state=bt
- Wikipedia "Dzong architecture" (battered walls, red ochre band, no plans, no nails, courtyards, tshechu venue); "Simtokha Dzong" (1629); "Ngawang Namgyal" (1616, chhoesi).
- Kachen pillar anatomy: research on Bhutanese timber columns (Buli Monastery conservation paper, ResearchGate) and factsanddetails.com summary.
- Kemar red band: multiple architecture guides.
- Wangdue Phodrang Dzong fire (24 June 2012) and consecration (11 November 2022): The Bhutanese, https://thebhutanese.bt/wangduephodrang-dzong-rises-again/
- Dress rules at dzongs: Department of Tourism travel tips (https://bhutan.travel/page/travel-tips) and operator guides; consistent with the site's travellers' information page.

### textiles
- Royal Textile Academy, About Us (instituted May 2005, museum 2001, patron Gyalyum Sangay Choden Wangchuck): http://www.rtabhutan.org/about-us/
- Asia InCH, Weaving and dyeing (thagzo): looms, fibres (bura, nettle, yak hair), dyes (lac, Symplocos, indigo, madder, walnut), regional traditions: https://asiainch.org/craft/weaving-dyeing-thagzo/
- Sonam Yudon, "Overview of Traditional Weaving (Thagzo) in Bhutan", SAARC Cultural Centre: http://saarcculture.org/wp-content/uploads/2020/07/tktce_Sonam_Yudon.pdf
- Yathra and natural dye revival in Chumey: Daily Bhutan, https://www.dailybhutan.com/article/chumey-weavers-revive-traditional-wool-dyeing-as-bumthangs-yathra-heritage-faces-new-challenges

### jomzo
- Wikipedia "Bhutanese art" (the thirteen arts list; Pema Lingpa; Tenzin Rabgye 1680 to 1694), cross-checked with the National Institute for Zorig Chusum (https://nizc.edu.gov.bt/) and Global InCH entry on NIZC.
- College of Zorig Chusum, Trashiyangtse, Sculpture (Jimzo) course page: https://czc.edu.gov.bt/courses/technical/sculpture-jimzo/ ; Encyclopedia of Crafts (WCC Asia Pacific), Jim zo.
- Lugzo and Newar origin: Handicrafts Association of Bhutan, https://www.handicraftsbhutan.org/lugzo-bronze-casting/
- Deh-sho and Jungshi factory (1990, Daphne bark): Druk Asia and operator guides.
- Thangka process and iconometry: Rubin Museum, Project Himalayan Art, https://rubinmuseum.org/projecthimalayanart/

### gross-national-happiness
- Centre for Bhutan and GNH Studies, 2022 GNH Survey Report (index 0.743, 0.756, 0.781; population shares): https://bhutanstudies.org.bt/wp-content/uploads/2025/01/2022-GNH-Survey-Report_compressed.pdf ; OPHI summary: https://ophi.org.uk/gross-national-happiness
- Origin of the phrase (1979, Bombay airport, after the NAM summit), treated as widely cited: Wikipedia "Gross National Happiness"; "The History of Gross National Happiness" (ResearchGate).
- Constitution of Bhutan (2008), Article 9 and Article 5 (60 per cent forest for all time).
- Forest cover 69.71 per cent (National Forest Inventory, published 2023) and carbon neutral pledge (COP15, 2009): Bhutan Second NDC, https://unfccc.int/sites/default/files/NDC/2022-06/Second%20NDC%20Bhutan.pdf
- SDF US$ 100 from 1 September 2023 to 31 August 2027: Department of Tourism announcements, https://bhutan.travel/announcements ; BBS, https://www.bbs.bt/245987/

### kira-and-gho
- Wikipedia "Kabney" (colours by rank; worn left shoulder to right hip; rachu).
- Wikipedia "Driglam namzha" (1989 reinforcement of national dress in schools, offices, formal occasions); "Wonju (Bhutan)".
- Daily Bhutan, ceremonial scarves: https://www.dailybhutan.com/article/the-different-types-of-ceremonial-scarves-in-bhutan

### archery
- Wikipedia "Archery in Bhutan" (national sport 1971, about 145 m, teams of 13, karay, astrologers, Olympic team since 1984, spectator safety).
- Bhutan Indigenous Games and Sports Association, traditional archery rules (bamboo bows required): http://www.bigsa.bt/?page_id=18
- Bhutan Olympic Committee, Bhutan Archery Federation: https://bhutanolympiccommittee.org/bhutan-archery-federation/
- Degor: Wikipedia "Digor (sports)"; traditionalsports.org.

### food
- Wikipedia "Bhutanese cuisine" (ema datshi, datshi, suja, meshu meshu etiquette).
- Slow Food Ark of Taste, Bhutanese red rice: https://www.fondazioneslowfood.com/en/ark-of-taste-slow-food/bhutanese-red-rice/
- Françoise Pommaret, "The Tradition of Betel and Areca in Bhutan", Journal of Bhutan Studies 8: https://himalaya.socanth.cam.ac.uk/collections/journals/jbs/pdf/JBS_08_03.pdf
- Meat sale ban in Saga Dawa: Chhukha Dzongkhag notification, https://chhukha.gov.bt/notification-on-the-ban-of-animal-slaughter-and-sale-of-meat-during-saga-dawa/ ; meat imports: The Bhutanese and Asian Ethnology, "Animal Slaughter and Religious Nationalism in Bhutan".
- Hoentey (Haa): Wikipedia "Hoentay".
- Our meals: trips.json (every meal included; trek cook).

### Left out because sources conflicted or could not be confirmed
- Khuru throwing distance (existing copy said about 20 m; BIGSA as cited by Wikipedia gives 35 m for men and 27 m for women). No distance printed.
- Archery target dimensions (sources give 91 x 28 cm and 60 x 30 cm). Described only as small.
- "Bemchag" as an architectural term: not found in any source; the red band is named kemar instead.
- Dzong entry fees and exact visiting hours: vary and could not be confirmed per dzong; stated as varying, as of 2026.
- "Only carbon-negative country": replaced with the inventory-based statement and the 2009 carbon-neutral pledge; sequestration tonnages vary by source and are not printed.
- The founding date of Thimphu Tshechu (BBS gives a century inconsistent with its named founder); omitted.

### Sources for journal-a.json

All checked September 2026. Company facts (itineraries, altitudes, inclusions, seasons) come from trips.json and pages-excerpt.txt.

### planning-a-first-journey-to-bhutan
- Department of Tourism, Visa page: https://bhutan.travel/visa (US$ 40 fee, five working days, documents, online application via immi.gov.bt)
- Department of Tourism, FAQs: https://bhutan.travel/faqs (SDF US$ 100; US$ 50 for age 6 to under 12; what SDF funds; guide mandatory at all times; certified operators list; insurance requirement lifted 23 April 2024; airlines and hubs)
- Department of Tourism, Announcements: https://bhutan.travel/announcements (insurance withdrawal 23 April 2024; border-town SDF SOP)
- Kuensel, "SDF for dollar-paying tourists halved": https://kuenselonline.com/sdf-for-dollar-paying-tourists-halved/
- The Bhutanese, "SDF to be USD 100 per day for next 4 years": https://thebhutanese.bt/sdf-to-be-usd-100-per-day-for-next-4-years/
- BBS, "SDF reduced to USD 100 per night": https://www.bbs.bt/191098/
- Kuensel, on the 2022 policy (operators not mandatory, guides required): https://kuenselonline.com/confusion-galore-who-will-benefit-from-the-new-tourism-policy-tour-operators-or-hoteliers/
- Drukair destinations and 2026 schedules: https://drukair.com.bt/plan/plan-your-trip/destinations/ and https://drukair.com.bt/wp-content/uploads/2025/10/SCHEDULE-APRIL-2026.pdf
- Bhutan Airlines 2026 schedule: https://www.bhutanairlines.bt/
- The Bhutanese, arrivals by entry point (Phuentsholing, Gelephu, Samdrup Jongkhar): https://thebhutanese.bt/tourist-arrivals-increase-by-more-than-90-percent-in-august-2025/
- 5% GST from 1 January 2026: https://www.vatupdate.com/2025/07/28/bhutan-to-implement-5-gst-in-january-2026-ending-sales-tax-exemptions/

### when-to-visit-bhutan
- Thimphu climate normals (NCHM data as tabulated): https://en.wikipedia.org/wiki/Thimphu
- 2026 festival dates (Paro, Thimphu, Jambay Lhakhang Drup, Trongsa, Crane Festival, Rhododendron Festival): https://www.tshechu.com/calendar/
- RSPN, history of the Black-necked Crane Festival (about 300 cranes, 11 November, since 1998): https://rspnbhutan.org/history-of-black-necked-crane-festival-in-bhutan/
- Dochula visibility and Punakha monk body: destinations.json (site content)

### dress-and-etiquette-in-dzongs-and-temples
- Department of Tourism FAQs (drones): https://bhutan.travel/faqs
- Tobacco Control Act and 2021 amendment; smoke-free places: https://www.tobaccocontrollaws.org/legislation/bhutan and https://en.wikipedia.org/wiki/Tobacco_Control_Act_of_Bhutan_2010
- Personal import allowance (200 cigarettes, duty payable), stated as "commonly given": secondary sources only (tobaccocontrollaws.org summary and operator customs guides); the Act leaves limits to the Tobacco Control Board
- Drone rules (BCAA, government use only): https://bcaa.gov.bt/faq-2/ (site did not load; confirmed via DoT FAQ)
- Trongsa monument guidelines from 1 January 2026: destinations.json (site content)
- Dress code specifics (collar/sleeve rule, no flip-flops): operator etiquette guides, consistent with pages-excerpt.txt

### altitude-in-bhutan
- NHS, Altitude sickness: https://www.nhs.uk/conditions/altitude-sickness/ (2,500 m threshold, symptoms, 500 m/night above 3,000 m, not 1,200 to 3,500 m in one day, descend 300 to 1,000 m, GP/travel clinic)
- CDC Yellow Book 2026, High-Altitude Travel and Altitude Illness: https://www.cdc.gov/yellow-book/hcp/environmental-hazards-risks/high-altitude-travel-and-altitude-illness.html (69% inspired oxygen at 3,050 m, HAPE/HACE signs, never ascend with symptoms, acetazolamide role, avoid alcohol 48 h, pre-existing conditions)
- Wilderness Medical Society Clinical Practice Guidelines, 2024 update: https://pubmed.ncbi.nlm.nih.gov/37833187/ (500 m/day, rest day every 3 to 4 days, terrain may force larger gains)
- Pele La 3,420 m, Punakha about 1,200 m, Trongsa about 2,200 m: https://en.wikipedia.org/wiki/Pele_La, https://en.wikipedia.org/wiki/Punakha, https://en.wikipedia.org/wiki/Trongsa

### what-to-pack-for-bhutan
- Plugs and voltage (type D and C, 230 V 50 Hz, some universal sockets): https://www.worldstandards.eu/electricity/plug-voltage-by-country/bhutan/
- Department of Tourism FAQs (ATMs accept Visa and Mastercard; SIM at Paro airport; drones): https://bhutan.travel/faqs
- Paro airport SIM counters: https://www.paroairport.com/airport-facilities/sim-card
- Money, antiques, coverage, shopping: pages-excerpt.txt

### a-hot-stone-bath
- Department of Tourism, "Precious Stones": https://bhutan.travel/journal/editorial/precious-stones (pomelo-sized stones, hatch, closed-off section, artemisia, seventh century origin, farmhouse setting, hospitality)
- Department of Tourism, "A winter's tale": https://bhutan.travel/journal/editorial/spa-ah (cold-season custom)
- Druk Asia, hot stone bath: https://www.drukasia.com/bhutan/paro/hot-stone-bath/ (stones added as water cools, 30 to 45 minute soak)
- NHS, saunas and hot tubs in pregnancy: https://www.nhs.uk/common-health-questions/pregnancy/is-it-safe-to-use-a-sauna-or-jacuzzi-if-i-am-pregnant/

### sitting-with-a-lam
- trips.json (meditation, valleys and tshechu itineraries: Kharchu, Tharpaling, Gangtey, day of silence, Taktsang sitting)
- destinations.json (Kharchu and Tharpaling context)
- General description of monastic etiquette consistent with pages-excerpt.txt; no named teachers or programmes

### Left out or hedged
- SDF end date: sources say 31 August 2027, one says extended to 30 September 2027. Written as "set to run into 2027".
- Punakha Tshechu 2026: destinations.json says 27 February to 1 March, tshechu.com says 27 to 28 February. Written as "late February".
- Monument entry fees: BBS/Kuensel (Nu 1,000 at seven sites) conflict with destinations.json (Nu 500, US$ 15). No fees quoted.
- Guide rule: some operator sites claim a 2025 relaxation; the DoT FAQ still says a guide at all times. Followed the DoT.
- Tharpaling altitude: trips.json gives 3,600 m (valleys) and 3,400 m (meditation). Used 3,600 m (matching destinations.json) in the altitude guide, and no figure in the meditation piece.
- Whether our prices include the SDF: not stated in trips.json, so the piece tells readers to ask and check the journey notes.
- Tobacco allowance of 200 cigarettes rests on secondary sources rather than the Act itself, so it is written as "commonly given".

### Sources for journal-b.json

### eleven-days-in-the-sacred-valleys
- trips.json, `valleys`: every day, altitude, drive time and visit is taken from it.
- Drukair / Druk Asia: Paro to Bumthang (Bathpalathang) flight about 35 minutes. https://www.drukasia.com/bhutan-druk-air/drukair-domestic-flights-to-bumthang-yonphula/
- Dungtse Lhakhang, Thangtong Gyalpo, 15th century, chorten form: https://en.wikipedia.org/wiki/Jangtsa_Dumtseg_Lhakhang (sources give 1421 or 1433, so the piece says only "fifteenth century")
- Kyichu Lhakhang, 7th century, Songtsen Gampo (stated as tradition): https://en.wikipedia.org/wiki/Kyichu_Lhakhang
- Tharpaling and Longchenpa: https://en.wikipedia.org/wiki/Tharpaling_Monastery ; https://www.rigpawiki.org/index.php?title=Tharpaling_Monastery
- Kharchu (Lhodrak Kharchu) Monastery, Namkhai Nyingpo Rinpoche: https://en.wikipedia.org/wiki/Lhodrak_Karchu_Monastery_(Bumthang) (founding year given differently in different sources, so it is left as "late twentieth century")
- Crane arrival late October: RSPN (see cranes piece).
- SDF US$ 100 until 31 August 2027: https://bhutan.travel/announcements ; https://www.bbs.bt/245987/

### timing-a-journey-to-paro-tshechu
- Paro Dzongkhag Administration, Annual Paro Tsechu: 11th to 15th day of the 2nd month, ceremonies from the 10th to the 16th, thongdrel of Guru Rinpoche's eight manifestations and two consorts, unveiled about 3 am at Deyangkha and returned before sunrise. https://paro.gov.bt/festivals/annual-paro-tsechu/
- Department of Tourism, "2026 festivals in Bhutan" (published 25 April 2025) and its PDF "tentative_festival_dates_2026.pdf": Paro Tshechu 29 March to 2 April 2026, thongdrel on the last day. https://bhutan.travel/journal/news/2026-festivals-in-bhutan
- No Department of Tourism list for 2027 found as of September 2026 (bhutan.travel journal checked). Operator sites print 18 to 22 March 2027 (others 19 to 23 March, one 17 to 21 April); not used as a fact.
- SDF US$ 100 until 31 August 2027: https://bhutan.travel/announcements ; https://www.bbs.bt/245987/
- trips.json, `tshechu` and `festival` itineraries.

### fifteen-days-to-jomolhari
- trips.json, `jomolhari`: all stages, altitudes, walking hours, rest days, crew and inclusions.
- Jomolhari 7,326 m, dwelling of the goddess Jomo, climbing not permitted: https://en.wikipedia.org/wiki/Jomolhari
- Lingzhi Yugyal Dzong, 1668, after victory over Tibetan invasion, earthquake damage and restoration, monks and sub-district office: https://en.wikipedia.org/wiki/Lingzhi_Y%C3%BCgyal_Dzong
- Pack horses, yaks on higher sections, autumn weather: https://followalice.com/adventure-trips/discover-bhutan/posts/bhutans-jomolhari-trek-route ; https://silverpinebhutan.com/en/blog/jomolhari-trek-guide/
- pages-excerpt.txt (travellers' information): no-signal stretches, tipping of cook, assistant cook and horsemen, "if anyone needs to go down, we go down".
- Conflict noted: most trek sources give the Nyile La as 4,870 to 4,890 m; the piece uses 4,930 m to match trips.json and BRIEF.md. Lingshi Dzong altitude given as 4,150 m or 4,370 m; left out.

### the-cranes-of-phobjikha
- RSPN, Black-necked Crane programme page: Grus nigricollis, thrung thrung karmo, Near Threatened, wintering sites, largest wintering population outside China, RSPN established 1987, festival since 1998. https://rspnbhutan.org/programs-projects/species-and-habitats/black-necked-crane/
- RSPN, Observing the Black-necked Cranes in Phobjikha: hide about 100 m from the roost, low voices and torches, stray dogs. https://rspnbhutan.org/observing-the-black-necked-cranes-in-phobjikha/
- RSPN, History of the Black-necked Crane Festival: 1998 start, Gangteng-Phobji Environment Management Committee, crane dance, entry fee since 2013. https://rspnbhutan.org/history-of-black-necked-crane-festival-in-bhutan/
- Kuensel, 19 February 2025, "Black-necked crane population increases but key habitats see decline": 709 in 2024 to 2025 (record), 370 in 1987, Phobjikha about 640, Bumdeling 59 (from 200 in 1987). https://kuenselonline.com/black-necked-crane-population-increases-but-key-habitats-see-decline/
- BBS, 18 February 2025: same winter; ICF and RSPN habitat project. https://www.bbs.bt/224945/
- BirdLife International, 2024: height about 1.3 m, breeding above 4,500 m, information centre with observation deck. https://www.birdlife.org/news/2024/11/22/a-himalayan-haven-for-the-black-necked-crane/
- Wangdue Phodrang Dzongkhag Administration: festival 11 November at Gangteng, arrival late October. https://wangduephodrang.gov.bt/tourism/black-necked-crane-festival/
- Circling of Gangtey three times, planting after arrival: https://en.wikipedia.org/wiki/Black-necked_cranes_in_Bhutan (stated as belief)
- Underground electrification (2007 planning, Austrian support, DoE, BPC, RSPN, work April to September, grid from April 2010; RSPN solar lighting): https://rspnbhutan.org/2010/04/ ; https://www.audubon.org/magazine/saving-sacred-black-necked-cranes-of-bhutan
- Conflicts left out: Phobjikha 2024 to 2025 count given as 640 (Kuensel) and 650 (BBS), so the piece says "more than 600"; the Conservation Area date (1999 RSPN, 2003 Wikipedia) and Ramsar designation year (2014 or 2016) are omitted. No 2025 to 2026 count was found published, so the 2024 to 2025 figure is used and dated.

### the-four-harmonious-friends
- Tittira Jataka (No. 37): three animals, banyan, partridge plants the seed, frame story of Sariputta sleeping under a tree, ruling on seniority, identifications. https://www.aimwell.org/DPPN/tittira_jataka_37_117_319.html ; https://thejatakatales.com/tittira-jataka-37/ ; https://ancient-buddhist-texts.net/Texts-and-Translations/Jatakagathavannana/037.htm
- Kuensel, Ugyen Penjore, 2 August 2005, "Understanding the symbolism of Thuenpa Puen Zhi" (reprinted by Buddhist Channel): versions of the story, five precepts, where it is painted, statements by Dasho Lam Sanga (interdependence, four pillars of GNH) and Thinley Wangchuk (ten virtues). https://www.buddhistchannel.tv/index.php?id=40%2C1531%2C0%2C0%2C1%2C0
- Daily Bhutan, the Bhutanese telling with the hare: https://www.dailybhutan.com/article/the-story-of-the-four-harmonious-friends-in-bhutan

### the-divine-madman
- Drukpa Kunley 1455 to 1529, Gya clan of Ralung, returned vows, son Ngawang Tenzin, Dowman and Paljor 1980, Monson 2014: https://en.wikipedia.org/wiki/Drukpa_Kunley
- Gendun Rinchen (1926 to 1997), 69th Je Khenpo, compiler of the biography Dowman translated: https://en.wikipedia.org/wiki/Gend%C3%BCn_Rinchen
- Monson, More Than a Madman (2014) and Tales of a Mad Yogi (2021); father murdered over land; "donkeys dressed in leopards' skins" (paraphrased, not quoted): https://asianreviewofbooks.com/tales-of-a-mad-yogi-the-life-and-wild-wisdom-of-drukpa-kunley-by-elizabeth-l-monson/ ; https://www.chronicleproject.com/tales-of-a-mad-yogi-the-life-and-wild-wisdom-of-drukpa-kunley-by-elizabeth-l-monson/
- Chimi Lhakhang 1499, Ngawang Choegyel, Dochula demon trapped in a rock, thunderbolt of wisdom: https://en.wikipedia.org/wiki/Chimi_Lhakhang ; https://www.chimilhakhang.com/about-chimi-lhakhang/about-drukpa-kinley
- Takin legend: https://www.drukasia.com/bhutan/punakha/chimi-lhakhang/ (told as legend)
- Phallus paintings: evil eye and gossip, eaves, possible pre-Buddhist roots, urban decline: https://en.wikipedia.org/wiki/Phallus_paintings_in_Bhutan
- Descendants: Tsewang Tenzin (1574 to 1643) and Tango; Tenzin Rabgye, fourth Druk Desi: https://en.wikipedia.org/wiki/Tenzin_Rabgye ; https://treasuryoflives.org/biographies/view/Tenzin-Rabgye/P512
- Left out: the legend of the arrow shot from Tibet to Bhutan (no reliable source found); the claim that he trained under Pema Lingpa at Ralung (appears only on Wikipedia and looks garbled); whether Ngawang Chogyal was his cousin (asserted by some tour sites, not confirmed).
