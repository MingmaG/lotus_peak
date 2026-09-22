# Lotus Peak — monorepo and admin panel: the build plan

Lotus Peak Tours & Travel is a Bhutanese company. The approved marketing design already
exists as a Next.js application; what does not exist is anywhere to edit it. Today every
word, price, itinerary day, photograph caption and phone number on the site is a TypeScript
literal, which means a deploy for a typo and a developer for a new departure.

This plan turns that application into a two-app monorepo — the website and the admin panel
that feeds it — modelled on `drokpo-treks`, with the Lotus Peak design as the source of
truth for what the content model has to be able to express.

**The design does not change.** Not the tokens, not the motion, not the section
composition, not the voice. The work is to move what the design renders out of module
constants and into rows, and to build the screens that write those rows.

---

## 0. Shape

```
lotus-peak/
├── apps/
│   ├── web/          :6010   the marketing site. No database credential.
│   └── admin/        :6011   the CMS + CRM. Owns the schema.
├── packages/
│   ├── api-contracts/        the wire format both apps agree on
│   ├── seo/                  the JSON-LD graph, built once, used by both
│   ├── email/                enquiry and notification templates
│   └── media/                what a stored image URL means
├── docker/           :6012   Postgres · :6013/6014 MinIO
├── content-import/           the WordPress export from lotuspeak.org
├── deploy/                   one VM, two apps, nginx, backups
└── docs/
```

Ports are 6010 (web), 6011 (admin), 6012 (Postgres), 6013/6014 (MinIO). Chosen against
what is already running on this machine — 3050, 4000, 4532, 4910/4911, 5000, 5432, 5435,
7000 are taken by other projects and are left alone.

### Why two apps and not one

Payload mounted at `/admin` was the original spec (`apps/web/docs/specs/06-cms-and-admin.md`).
It is dropped for the same three reasons drokpo dropped it:

1. **The website should have no database credential.** It reads
   `http://localhost:6011/api/public/site/*`, prerenders every page, and is told to rebuild
   a page when something it renders is saved. A site that cannot reach the database cannot
   leak a draft.
2. **The admin is a CRM as well as a CMS.** Enquiries, customers, email threads, WhatsApp
   and newsletter subscribers are not content, they are personal data, and they want their
   own app with its own auth, roles and audit log — not a collection in the site's bundle.
3. **The office is not a CMS specialist.** The screens have to speak in Lotus Peak's own
   words ("Journey", "Rest day", "Reflection"), which is a bespoke admin, not a generic one.

The seam this rests on already exists and is the reason this is safe: `apps/web`'s pages
depend on `ContentRepository` (`src/content/repository.ts`), never on where content lives.
Swapping the file provider for an API provider is one adapter file. **No page, section,
design-system component or motion hook changes.**

---

## 1. Phases

Each phase leaves the repo in a state that builds and runs.

### Phase 0 — Restructure ✅

Move the existing repo up to `lotus-peak/`, `git mv` the Next app into `apps/web/`, and add
the workspace root, the Docker stack and the shared `.env` conventions. History and the
GitHub remote are preserved.

### Phase 1 — Shared packages

`api-contracts` is types only: the shape of every `/api/public/site/*` payload, and the
`REVALIDATE_TAGS` both apps name. `seo` builds the JSON-LD graph from those payloads so the
admin's SEO preview and the site's `<script type="application/ld+json">` cannot disagree.
`email` holds the enquiry templates. `media` parses a stored image URL into a `srcset`.

### Phase 2 — Admin foundation

Next 15 on :6011. Tailwind v4 + shadcn/ui, matching drokpo so components port across.
JWT sessions (`jose`) with refresh, bcrypt logins, roles and per-resource permissions,
an activity log on every write. The shell is a collapsible sidebar that becomes a sheet
under 1024 px; every table has a card layout under 768 px.

Media library first, because everything else references it: folders, drag-upload, `sharp`
derivatives, **required alt text**, focal point, and an S3 driver pointed at MinIO in dev
and Supabase in production.

### Phase 3 — The content model

One Prisma schema, written from what the design renders — see §2. Then a seed that loads
the real site: the five journeys, the journal, the six pages, the twenty-eight gallery
photographs, the destinations, activities, seasons, culture articles and reflections, read
out of `apps/web/src/content/data/` and `content-import/wordpress/`.

The seed is the proof the model is complete. Anything the design renders that the seed
cannot carry is a missing column, and it is found here rather than in month three.

### Phase 4 — The screens

Dashboard · Journeys · Departures · Destinations · Activities · Seasons · Culture ·
Journal · Gallery · Reflections · Pages · Navigation · Media · Enquiries · Customers ·
Newsletter · Emails · Reviews · Settings · SEO · Users · Activity.

Every list is searchable, filterable, sortable and paginated. Every editor is tabbed
(Content · Media · SEO · Publishing), autosaves a draft, shows a live preview, and blocks
publish on the same validation the site's build runs.

### Phase 5 — Public API, and cutting the website over

`/api/public/site/*` in the admin, `ApiProvider` in the web app, and the deletion of
`src/content/data/`. Publishing POSTs `/api/revalidate` on the website with the tags it
touched; an hourly `CONTENT_REVALIDATE_SECONDS` is the backstop for a push that was lost.

**The check is not "it builds".** Before the cutover, `npm run build` in `apps/web` and keep
every rendered `.html`. After it, build again and diff. Anything that changed is either a
bug or a decision, and it gets written down. That is how drokpo held its own migration to
45 of 47 pages byte-identical.

The inline copy that is currently in page files — the home page's three purposes, About,
Terms, Travellers' information, Contact — moves into `Page` rows with typed sections in the
same pass. After this phase there is no user-facing English in `apps/web` outside the design
system's own labels.

### Phase 6 — SEO, GEO and AI surfaces

The site is already fast and server-rendered; what it lacks is everything that makes it
*findable* and *quotable*. See §3.

### Phase 7 — Preview, responsiveness, QA

Preview is `draftMode()` on the **real website**, not a reimplementation of it: the admin's
Preview button opens `/api/preview?token=…&path=/trips/valleys` on :6010, which flips draft
mode and renders the actual page from unpublished rows. Inside the admin that URL is shown
in an iframe with phone / tablet / desktop widths, so the editor sees the real thing at the
real breakpoints. A reimplemented preview drifts; this one cannot.

Then: a responsive pass at 360 / 414 / 768 / 1024 / 1280 / 1536 on both apps, a
reduced-motion pass, a no-JS pass, Lighthouse, and axe.

---

## 2. The content model, read off the design

Lotus Peak's structure is **not** drokpo's, and the design is the source of truth. What the
pages actually render:

| Entity | Why it exists | Notes |
|---|---|---|
| `Trip` | `/trips`, `/trips/[slug]` | Four types: mindfulness · meditation · festival · trekking. Carries duration, nights, high point, difficulty, price from, season label, pace note, journey label |
| `ItineraryDay` | the day-by-day | `rest: true` days carry no number; numbering is computed, never stored |
| `TripHighlight` · `TripInclusion` · `TripExclusion` · `TripFaq` · `TripGalleryItem` | ordered, trip-scoped | Own tables, not JSON: they are reordered constantly and the editor needs drag handles |
| `Destination` | `/destinations` | Ordered `tripSlugs` → an explicit join with a sort column, because the region line reads "Paro · Bumthang · Trongsa" and the order is editorial |
| `Activity` | `/activities` | The three WordPress groupings, with `examples[]` |
| `Season` | the home page's four-panel season band | spring/summer/autumn/winter, with months label, headline, summary, detail |
| `CultureArticle` | `/culture` | Icon + image + body |
| `Post` | `/journal`, `/journal/[slug]` | Body is **one rich-text document**, written in the same editor as every other long-form field — see below |
| `GalleryImage` | `/gallery` | Caption and masonry aspect ratio |
| `Reflection` | testimonials, everywhere | A quote and a quiet attribution. **No star rating, ever** — the design forbids it |
| `Page` | About · Contact · Terms · Travellers' information · home sections | Typed sections, not a free block builder |
| `Enquiry` | the only conversion path | From the contact page, a trip page, or the drawer |
| `Media` | everything above | Alt text required at the database, not just the form |

### The journal body: typed blocks, and why they were given up

This plan called for a **block editor** — add block, choose kind, reorder, delete — with
the column as `Json` validated by the same Zod union on both sides of the wire. The
argument was a real one: the design renders a `facts` block as a bordered table in the
site's own type scale, and HTML from a toolbar renders as whatever the toolbar emitted.
It was built that way and shipped that way.

It was replaced, and this is the record of why.

**The vocabulary was not the cost; the boxes were.** Writing an entry meant choosing
which box a sentence went in before writing the sentence. A photograph could not sit
inside a paragraph. A table had two columns — label and value — or it did not exist. A
list could not contain a link. And the effort of maintaining a second editor bought
nothing the first one could not do, because by then *every other* long-form field on the
site — a journey's overview, an itinerary day, a page band, a teacher's biography — was
one HTML string in the full editor. The journal was the only thing on the site written a
different way from everything else on it.

**The guarantee moved rather than disappeared.** What actually stopped a pasted
`<h1 style="color:red">` reaching a page was never the shape of the column: it was
`apps/web/src/lib/rich-text.ts`, which rebuilds a body from an allowlist of the elements
an article may contain and drops the rest. That already guarded the eleven other HTML
columns. Pointing it at a twelfth is one implementation checked on the way *out*, rather
than a union that only ever described what one editor happened to emit.

**What the old blocks became**, in the migration and in both seeds:

| was | is |
| --- | --- |
| `text` | its own HTML, or `<p>` where it held plain prose |
| `heading` | `<h2>` — a body's headings start there; H1 is the title |
| `list` | `<ul>` / `<ol>` |
| `quote` | `<blockquote>`, attribution as a trailing em-dashed line |
| `facts` | an `<h4>` label and a two-column `<table>` — still a table a crawler and an assistant can lift a value out of, which was the strongest argument for the block |
| `image` | `<figure data-media-id>`, which now also carries a description, a caption, a credit and a title |

A photograph is still **referenced, never serialised**: the column holds the media id and
the URL is filled in from the `Media` row on every read, so re-cropping or re-describing a
photograph reaches every entry that used it.

### One source of truth for the company

Everything the footer, the contact page, the enquiry email, the JSON-LD `Organization` and
the WhatsApp link currently repeat is one row each, edited in one screen:

```
CompanyProfile   legal name · trading name · tagline · founded · licence no · TCB cert
ContactChannel   phone · mobile · whatsapp · email · each with a label and a display order
Address          street · locality (Thimphu) · dzongkhag · country · postcode · lat/lng
                 …because `addressLocality` in the structured data and the line the footer
                 prints are different strings, and typing both is how they drift
SocialLink       platform (enum: INSTAGRAM · FACEBOOK · YOUTUBE · X · TIKTOK · LINKEDIN ·
                 PINTEREST · TRIPADVISOR · WHATSAPP · THREADS · OTHER) · handle · url · order
OfficeHours      day range · open · close · closed flag
```

`+975 17984485` and `info@lotuspeak.org` appear **once** in the database and nowhere in
the code. The social platform is an enum so the site can pick the right icon and the right
`sameAs` entry without a string match on a URL.

---

## 3. SEO, GEO and AI

The requirement is "highly SEO / GEO / AI friendly". Concretely, and all of it editable:

**Per-entity, on every content type:** meta title and description with length counters,
canonical, `noindex`/`nofollow`, OG title/description/image, Twitter card, focus keyword
with a readability and keyword-placement score, sitemap priority and change frequency, and
**slug history** — so renaming a journey emits a 301 automatically instead of dropping an
indexed page.

**Structured data**, built in `packages/seo` from the same payload the page renders, so a
preview in the admin is the bytes the crawler gets:
`TravelAgency` (with the real `postalAddress`, `geo`, `openingHoursSpecification`, `sameAs`
from the social links) · `WebSite` + `SearchAction` · `BreadcrumbList` on every page ·
`TouristTrip` with `itinerary` as an `ItemList` of `TouristDestination`, `offers`,
`duration` in ISO 8601 · `Article` on journal entries · `FAQPage` wherever FAQs render ·
`ImageObject` with real dimensions · `Review`/`AggregateRating` **only** if Lotus Peak ever
collects verifiable reviews, and not before.

**Generative engines** read differently from crawlers — they want the facts without the
chrome:
- `/llms.txt` — the site in one screen, generated from published rows.
- `/llms-full.txt` — every journey and journal entry as clean markdown.
- A `<Facts>` block on every journey rendering duration, altitude, difficulty, price and
  season as a real `<dl>`, because a fact in a sentence is a fact a model has to infer and a
  fact in a definition list is one it can lift.
- Answer-shaped FAQ headings, and `speakable` on the standfirst.
- `/feed.xml`.

**Operational:** sitemap from published rows only, `robots.txt` with the admin excluded, a
redirect table with hit counts, a 404 log so real broken inbound links become redirects
rather than guesses, and an internal-link suggester that notices a journal entry naming
"Jomolhari" and offers the link.

---

## 4. Rules this build holds itself to

- **The design is approved and does not change.** New admin-editable fields render through
  existing design-system components. If something needs a new component, it is built in the
  established idiom — tokens only, no hardcoded hex, no second typeface, saffron is the only
  CTA colour, one filled button per section.
- **Nothing user-facing is static.** No English in `apps/web` outside the design system.
- **The admin never leaks past the API.** `apps/web` imports `@lotuspeak/api-contracts`, and
  a Prisma type never reaches a component.
- **Alt text is required.** Both apps are responsive at 360 px and audited with axe.
- **Every write is logged**, with who and what changed.
- **`prefers-reduced-motion` is honoured** in both apps, in CSS and in JS.

---

## 5. Order of work

```
0  restructure                              ✅
1  packages: api-contracts, seo, email, media
2  admin: auth, shell, media library
3  schema + seed from the real site
4  admin screens, content first, then CRM
5  public API, ApiProvider, delete src/content/data, HTML diff
6  SEO / GEO / AI surfaces
7  preview, responsive pass, QA
```

Phases 1–3 are prerequisites for everything. Phase 4 is the bulk. Phase 5 is the one with a
hard acceptance test attached, and it is the one that would be expensive to get wrong.
