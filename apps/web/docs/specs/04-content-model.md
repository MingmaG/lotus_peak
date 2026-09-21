# 04 — Content model

The domain types are the contract between the site and whatever stores the content. They are
defined once, in `src/content/schema/`, as Zod schemas with inferred TypeScript types. Every
provider maps *into* these; nothing maps out.

Design rules:

- **Presentation-neutral field names.** `heroImage`, not `parallaxHeroSrc`. The model
  describes the journey, not the layout.
- **No provider ids leak.** Every entity has our own `id` (stable, provider-independent) and
  `slug`. A Sanity `_id` or a Payload `ObjectId` stays inside its adapter.
- **Everything optional is genuinely optional.** A page must render with only the required
  fields present; sections disappear rather than break.
- **Localisation-ready, not localised.** Every user-facing string field is typed
  `Localised<string>` = `string | Record<Locale, string>`, with a `resolve(value, locale)`
  helper. Phase 1 stores plain strings; adding Dzongkha later is a data change, not a
  refactor.

## 1. Entities

```
Trip ──< ItineraryDay
     ──< Highlight, Inclusion, Exclusion, FaqItem   (ordered value objects)
     ──> MediaAsset (hero), MediaAsset[] (gallery)
     ──> Destination[]        (regions visited)
     ──< Reflection           (testimonials attributed to this trip)
Destination ──> MediaAsset
Season      ──> MediaAsset
CultureArticle ──> MediaAsset
Page (singleton: home, about, contact) ──< Section blocks
SiteSettings (singleton)
Enquiry     (write-only from the site)
```

## 2. Schemas

### `Trip`

The central entity. Field-by-field, with the prototype value that proves it is needed.

```ts
Trip = {
  id: string
  slug: string                       // 'valleys' | 'meditation' | 'festival' | 'jomolhari'
  title: Localised<string>           // 'A mindfulness journey through Bhutan’s sacred valleys'
  excerpt: Localised<string>         // one sentence, used on cards and as the detail h2
  type: 'mindfulness' | 'meditation' | 'festival' | 'trekking'
  status: 'draft' | 'published'
  order: number

  // Facts — rendered by the Fact / Badge row
  durationDays: number               // 11
  nights: number                     // 10
  highPointMetres: number            // 3120
  difficulty: 'gentle' | 'moderate' | 'demanding'
  priceFrom: { amount: number; currency: 'USD' }   // 4500
  seasons: SeasonKey[]               // ['spring','autumn']
  paceNote: Localised<string>        // 'One rest day' | 'Daily sitting practice'
  destinations: Ref<Destination>[]   // ordered: Paro · Bumthang · Trongsa · …

  heroImage: Ref<MediaAsset>
  gallery: Ref<MediaAsset>[]

  overview: Localised<RichText>      // the three paragraphs on the detail page
  highlights: Localised<string>[]    // 7 items, rendered as a hairline-led list
  itinerary: ItineraryDay[]
  included: Localised<string>[]
  excluded: Localised<string>[]
  faq: { question: Localised<string>; answer: Localised<string> }[]

  seo?: Seo
  updatedAt: string                  // ISO
}

ItineraryDay = {
  day?: number          // omitted on rest days; Itinerary renders 'Rest' and a hollow gold node
  rest?: boolean
  title: Localised<string>          // 'Arrive in Paro'
  meta?: Localised<string>          // '2,200 m' | 'Drive · 4 h' | '3,120 m · 5 h' | 'Full day'
  body?: Localised<RichText>
}
```

Derived, never stored: `durationLabel` ("11 days"), `nightsLabel` ("10 nights"),
`altitudeLabel` ("3,120 m"), `priceLabel` ("US$ 4,500"), `regionLabel`
("Paro · Bumthang · Trongsa"). Formatting lives in `src/content/format.ts` so the
thin-space/middot conventions are applied in one place. The prototype stores these as
pre-formatted strings — do not carry that over, it makes the data unsortable and
unlocalisable.

**Content debt (audit B14).** Only `valleys` has an itinerary, and `highlights`, `included`,
`excluded` and `faq` are shared constants across all four trips. Three journeys' worth of
content must be authored. Treat `itinerary.length === 0` as a publish blocker in validation.

### `Destination`

```ts
Destination = {
  id, slug, name: Localised<string>          // 'Paro'
  icon: SiteIconName                          // 'dzong' | 'buddha' | 'dzong-long' | …
  blurb: Localised<string>                    // 'Taktsang, Kichu and Dungtse Lhakhang'
  image?: Ref<MediaAsset>
  order: number
}
```
Six today: Paro, Thimphu, Punakha, Bumthang, Trongsa, Phobjikha.

### `Season`

Rich — the home page's seasons block has a summary *and* an expandable detail paragraph.

```ts
Season = {
  key: 'spring'|'summer'|'autumn'|'winter'
  monthsLabel: Localised<string>     // 'Mar – May'
  name: Localised<string>            // 'Spring'
  headline: Localised<string>        // 'Clear skies and festivals'
  summary: Localised<string>         // the always-visible paragraph
  detail: Localised<RichText>        // the Disclosure body: temperatures, rainfall, festivals
  image: Ref<MediaAsset>
  order: number
}
```

### `CultureArticle`

```ts
CultureArticle = {
  id, slug, title: Localised<string>, body: Localised<RichText>,
  icon: SiteIconName, image: Ref<MediaAsset>, order: number, status
}
```
Six today: Tshechu, Dzongs, Textiles, Jomzo and the crafts, Gross National Happiness,
Kira and gho.

### `Reflection`

```ts
Reflection = {
  id, quote: Localised<string>, name: string,
  detail?: string,                   // 'Bumthang, 2026'
  trip?: Ref<Trip>, featured: boolean, order: number
}
```
No rating field. Ever. If a CMS adds one, the adapter drops it.

### `MediaAsset`

```ts
MediaAsset = {
  id, src: string, alt: Localised<string>,
  width: number, height: number,     // required — next/image and CLS depend on them
  focalPoint?: { x: number; y: number },   // 0–1; parallax crops hard, faces must survive
  blurDataURL?: string, credit?: string, kind: 'imagery'|'illustration'|'ornament'|'texture'|'icon'
}
```

`alt` is required and non-empty for content images. Decorative images (motifs, the Dignities
layer, `Strip` fills) are not `MediaAsset`s — they are hardcoded in the motion layer with
`alt=""` and `aria-hidden`.

### `Page`

Singletons for home, about and contact — the parts an editor should be able to change without
a deploy. Modelled as an ordered block list, with a closed union of block types so a CMS
cannot invent a section the site cannot render:

```ts
Block =
  | { type: 'hero';        eyebrow?, title, lead?, image: Ref<MediaAsset>, cta?: Cta }
  | { type: 'statement';   eyebrow?, number?, title, lead?, columns: {title, body}[] }
  | { type: 'tripGrid';    eyebrow?, number?, title?, limit?: number, filter?: TripType }
  | { type: 'band';        eyebrow?, title, body?, image: Ref<MediaAsset>, cta?: Cta, height? }
  | { type: 'destinations';eyebrow?, number?, title?, lead?, ground: true }
  | { type: 'split';       eyebrow?, number?, title, body: RichText, image, caption?, flip?, cta? }
  | { type: 'strip';       images: Ref<MediaAsset>[], caption? }
  | { type: 'seasons';     eyebrow?, number?, title?, lead? }
  | { type: 'reflections'; eyebrow?, number?, limit?: number }
  | { type: 'richText';    eyebrow?, number?, title?, body: RichText }
```

`Page = { id, slug: 'home'|'about'|'contact', title, blocks: Block[], seo?, updatedAt }`.

A `<BlockRenderer>` maps each type to a section component and ignores unknown types with a dev
warning. This is how the home page becomes editable without giving an editor the ability to
break the layout.

### `SiteSettings`

```ts
SiteSettings = {
  brand: string                      // 'Lotus Peak'
  logo: Ref<MediaAsset>
  nav: { label: Localised<string>; href: string }[]
  navCta: { label: Localised<string>; href: string }
  footer: { columns: { title: Localised<string>; links: { label, href }[] }[]; note?: string }
  contact: { phone: string; email: string; addressLines?: string[] }
  social: { label: string; href: string }[]
  pledge: { percent: number; beneficiary: string }   // 30, 'Osel Ling Perila Goenpa'
  sdf: { amountPerNightUsd: number }                 // 100
  defaultSeo: Seo
}
```

Every nav and footer link comes from here. That removes the prototype's label-matching router
(`index.html` maps `'Blog' → culture`, `'Gallery' → about`) which is both fragile and, for
two of its entries, wrong — they point at pages that do not exist yet.

### `Enquiry`

The only thing the site writes.

```ts
Enquiry = {
  id, createdAt,
  name: string, email: string,
  country?: string, phone?: string,
  tripSlug?: string, travellers?: string, adults?: number, children?: number,
  preferredDates?: string,           // free text: 'a month, or a season'
  message?: string,
  restDays?: boolean,
  source: 'contact' | 'trip-detail' | 'drawer',
  status: 'new' | 'replied' | 'archived',
  meta: { userAgent?, referrer?, locale? }
}
```

Deliberately loose on dates and party size — the design asks for "a month, or a season", not a
date picker. Do not tighten it into a booking form. See `08-forms-and-enquiries.md`.

## 3. Rich text

`RichText` is **portable JSON**, not HTML and not MDX-at-runtime: an array of blocks
(`paragraph`, `heading`, `list`, `quote`, `image`, `link` marks). Reasons: Payload's Lexical,
Sanity's Portable Text, Strapi's blocks and our file provider's MDX can all be converted to
it; HTML from a CMS would have to be sanitised and would smuggle in styling that breaks the
token system.

`src/content/richtext/` holds: the type, a renderer mapping blocks to design-system elements,
and one converter per provider. The renderer never emits a class or style that is not from the
design system.

## 4. Validation

Every provider returns data through `schema.parse()`. On failure:

- **Build time** (static generation): throw. A malformed trip must not ship.
- **Request time** (ISR revalidation, preview): log with the entity id and field path, serve
  the last good cached value, and surface the error in the admin if one is mounted.

Publish-blocking rules, checked by `pnpm content:validate` in CI:

- A published `Trip` has ≥ 1 itinerary day, a hero image with alt text, a price, and at
  least 3 highlights.
- Every `Ref` resolves.
- Every `MediaAsset` has non-zero `width`/`height`.
- No two published entities of a kind share a `slug`.
- Every `SiteSettings.nav` and footer `href` resolves to a real route.

## 5. Seed data

`content/` holds the prototype's copy as the file provider's data, so phase 1 runs with real
content and no database:

```
content/
  trips/{valleys,meditation,festival,jomolhari}.mdx     frontmatter + itinerary + body
  destinations.json      seasons.json      reflections.json
  culture/{tshechu,dzongs,textiles,jomzo,gnh,dress}.mdx
  pages/{home,about,contact}.mdx
  settings.json          media.json
```

This is also the fixture set for tests, and the reference payload a new provider is checked
against: `pnpm content:verify --provider=<name>` asserts a provider returns data equivalent
to the file provider for the same seed.
