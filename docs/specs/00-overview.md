# 00 — Overview

## What we are building

The production website for **Lotus Peak Tours & Travel**, Bhutan. Six screens, already
designed in full, to be rebuilt in Next.js on a foundation that can (a) swap its database
without touching a page, and (b) have a CMS admin panel attached without rewriting the site.

Existing site: `lotuspeak.org`. Contact: `+975 17984485`, `info@lotuspeak.org`.

## Why it exists

Lotus Peak runs small-group journeys built around meditation, pilgrimage and time with
Rinpoches and Lams. Thirty percent of income supports Osel Ling Perila Goenpa, a monastery in
the hills above Paro. The site's single conversion goal is **an enquiry** — not a booking.
Copy says so explicitly: *"No deposit, no obligation. Just a reply."* There is no cart, no
checkout, no payment, no live availability. Design the funnel accordingly.

## The four journeys

| id | Title | Type | Length | High point | Pace | From |
| --- | --- | --- | --- | --- | --- | --- |
| `valleys` | A mindfulness journey through Bhutan's sacred valleys | Mindfulness | 11 days / 10 nights | 3,120 m | Moderate | US$ 4,500 |
| `meditation` | Mindful journeys with meditation and Buddhist practice | Meditation | 10 days / 9 nights | 3,400 m | Demanding | US$ 4,500 |
| `festival` | Sacred rhythms of Bhutan: a festival and meditation journey | Festival | 5 days / 4 nights | 3,100 m | Gentle | US$ 3,000 |
| `jomolhari` | Jomolhari trek: a journey into joyful heights | Trekking | 15 days / 14 nights | 4,930 m | Demanding | US$ 7,000 |

Prices are per adult and include the Sustainable Development Fee (US$100 per person per
night) paid to the Royal Government of Bhutan.

## Screens

| Route | Screen | Notes |
| --- | --- | --- |
| `/` | Home | Parallax hero, purpose, four trips, culture band, destinations, Jomzo split, gallery strip, seasons, reflections, begin band |
| `/trips` | Our trips | Filter tabs + two-column editorial cards |
| `/trips/[slug]` | Trip detail | The deepest page: sticky section nav, overlapping images, facts, in-page enquiry, itinerary, inclusions, FAQ, reflections |
| `/about` | About | Window-framed Taktsang, three commitments, 30% pledge, reflection |
| `/culture` | Culture | Parallax hero, six alternating articles, festival band |
| `/contact` | Contact | Enquiry form + contact aside |

Plus, not in the prototype and in scope for phase 3: `/journal` (blog), `/gallery`,
`/travellers-information`, `/terms`. The prototype's footer already links to all four.

## Success criteria

**Fidelity.** The built site is indistinguishable from the design project's standalone
prototype at 1440×900, and behaves coherently down to 360px.

**Effects.** Every effect in `docs/specs/03-motion-and-effects.md` works, and the twelve
defects in `docs/audit/effects-integration.md` are not reproduced.

**Portability.** `CONTENT_SOURCE=file` and `CONTENT_SOURCE=payload` both build, both serve
the same pages, and no page component changes between them. A third adapter can be written
against the interface without reading any page code.

**Performance.** LCP ≤ 2.5s and CLS ≤ 0.1 on a 4G Moto G, on Home and Trip detail — the two
heaviest pages. Interaction to Next Paint ≤ 200ms with all parallax layers active.

**Accessibility.** WCAG 2.2 AA. Full keyboard path to an enquiry. Reduced-motion users get a
completely still, completely legible site.

**Content.** All four journeys fully authored (see audit B14) before launch.

## Out of scope

Payments, availability calendars, user accounts, multi-currency, live chat, and translation.
The content model leaves room for localisation (§`04-content-model.md`) but phase 1 ships
English only.

## Reading order

1. `01-architecture.md` — the shape of the app
2. `02-design-system.md` — tokens and components
3. `03-motion-and-effects.md` — the effects contract
4. `04-content-model.md` — the domain types
5. `05-data-layer.md` — database-agnostic repository
6. `06-cms-and-admin.md` — CMS-agnostic providers and the admin panel
7. `07-pages-and-routing.md` — screen-by-screen composition
8. `08-forms-and-enquiries.md` — the one conversion path
9. `09-quality.md` — performance, SEO, accessibility, testing
10. `10-roadmap.md` — phased delivery
