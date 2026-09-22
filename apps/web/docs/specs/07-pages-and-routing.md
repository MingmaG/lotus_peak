# 07 — Pages and routing

Six routes, composed from `src/sections/`. Each entry below gives the section order, the
content it needs, and the effects it carries, so a page can be built and reviewed against a
checklist rather than a screenshot.

Shared shell — `app/(site)/layout.tsx`:

```
<Dignities/>        fixed page-wide watermark, exactly one instance
<Halo/>             fixed radial breath, z-index 150
<NavBar/>           writes --nav-h; inverse over heroes; frosted when scrolled
{children}          keyed by pathname, wrapped in the 1.6s `surface` animation
<Footer/>           columns and links from SiteSettings
<InquiryDrawer/>    opened from anywhere via context
<Toast/>            fixed bottom-left, same context
```

`NavBar` gets `inverse` on routes whose first section is a full-bleed hero: `/`,
`/trips/[slug]`, `/culture`. On `/trips`, `/about` and `/contact` it renders on paper from
the start.

---

## `/` — Home

| # | Section | Content | Effects |
| --- | --- | --- | --- |
| 1 | Hero | `Page(home)` hero block | `Parallax` speed .6 + `mist` on the image, gradient scrim, staged 0/240/520/760, `ScrollCue` |
| 2 | Purpose | statement block, 3 columns | `Reveal` 0/300, columns at 250 + i·120, each over a gold `Divider` |
| 3 | Trip grid | `trips.list({ limit: 4 })` | `TrekCard`s staged i·220, `y=40`; "All trips →" ghost button |
| 4 | Culture band | band block (Taktsang) | `Band` speed 1.2, 88vh, staged 0/240/480/720 |
| 5 | Destinations | `destinations.list()` | Dark `ground`; `ShadowArt` motif `friends` (audit B1); framed `SiteIcon`s at 88px; rows staged i·180 |
| 6 | Jomzo split | split block | `Split` 1.35fr/1fr, image `Parallax` speed .5, caption, outline CTA |
| 7 | Gallery strip | strip block, 5 images | `Strip`, mixed ratios 4/5 · 3/2, items staged i·320 |
| 8 | Seasons | `seasons.list()` | `--surface-sunken`; four rows, each `Disclosure` + `Parallax` speed .4, alternating image width |
| 9 | Reflections | `reflections.list({ featured: true, limit: 2 })` | Two columns, staged 0/320; `ShadowArt` only if the section is given a dark ground |
| 10 | Begin band | band block (Punakha bridge) | `Band` 70vh, inverse CTA opening the drawer |

LCP is the hero image: `priority`, `fetchPriority="high"`, AVIF, preloaded.

## `/trips` — Our trips

Header (eyebrow, h1 "Four ways through the kingdom", lead), `Tabs` filter, two-column
`TrekCard size="lg" kera={false}` grid.

- Filter is the URL param `?type=mindfulness|meditation|festival|trekking`; "All" is no param.
  Server-filtered via `trips.list({ type })`, so results are shareable and crawlable.
- **Audit B2**: this screen currently has no entrance animation at all. Stage the header
  0/200/400 and the cards at i·220, `y=40`, re-keyed on filter change so the stagger replays.
- `Tabs` is a client component; changing it does a shallow route update.
- Empty state: "No journeys of that kind yet. Write to us and we will build one." + drawer CTA.

## `/trips/[slug]` — Trip detail

The deepest page. `generateStaticParams` from `trips.slugs()`; unknown slug → `notFound()`.

| # | Section | Effects |
| --- | --- | --- |
| 1 | Hero | `Parallax` speed .6, 92vh, centred, flat scrim + `--protection` gradient, staged 0/240/520/800 with `ScrollCue` |
| 2 | Sticky section nav | `position: sticky; top: calc(var(--nav-h) - 1px)`, scroll-spy underline, smooth jump offset `--nav-h + 56` |
| 3 | `#overview` | Two overlapping images — main at `aspect 4/5` with `Parallax` speed .5, second offset bottom-right at 52% width with a 6px paper border, revealed at delay 400, `y=60`. Copy + `Badge` row |
| 4 | `#highlights` | "At a glance" `Fact` grid (gold top rules) + price panel with an `SDF` `Tooltip`; highlights list staged i·140 |
| 5 | `#enquiry` | `--surface-sunken`; contact column + the in-page form. See `08-forms-and-enquiries.md` |
| 6 | Trail band | `Band` 80vh |
| 7 | `#itinerary` | Centred header with flanking gold rules; expand/collapse all; `Itinerary collapsible` over `Disclosure` |
| 8 | `#included` | Two hairline-separated lists |
| 9 | Gallery | `Strip`, six images, mixed ratios |
| 10 | `#essential` | FAQ over `Disclosure` (audit B12 — currently an instant pop) |
| 11 | `#reflections` | Two `Reflection`s + CTA + "From US$ 4,500 per adult" |

`KeraRule` (`Divider variant="kera"`) separates 4→5, 7→8 and 10→11.

Section nav ids are fixed: `overview`, `highlights`, `enquiry`, `itinerary`, `included`,
`essential`, `reflections`. They are also deep-link targets, so the scroll-spy must not
fight a hash arriving in the URL — set the active section from the hash on mount before
arming the spy.

**Audit B14**: three of four trips have no itinerary content. Until authored, an unauthored
trip must not be published — do not fall through to `valleys` as the prototype does.

## `/about`

Hero with `WindowFrame` Taktsang (one per page, never in a grid) + two gold-ruled commitments;
"Our purposes" — three alternating image/copy rows; `KeraRule`; dark pledge section with
`ShadowArt` motif `thangka` (audit B1) and two CTAs; a single `Reflection`.

**Audit B3**: the hero block and the purpose rows are currently unanimated. Stage them.

## `/culture`

Full-bleed `Parallax` hero (speed .6, 92vh, bottom-aligned), then six alternating articles —
each a `Parallax` image (speed .5, ratio alternating 3/2 and 4/5) opposite a `SiteIcon`,
`h2` and body, staged 0/240/480, with `direction: rtl` flipping alternate rows. Closes with a
`Band` 76vh CTA into the festival journey.

Articles come from `culture.list()`. Phase 3 adds `/culture/[slug]` detail pages; the model
already supports it.

## `/contact`

Header, two columns: the enquiry form (left, max 640px) and an aside (right, 380px) with a
`kera` divider, contact details and the "No deposit, no obligation" note. **Audit B3**: add
the standard staging.

## Navigation and links

Every link comes from `SiteSettings` (`04-content-model.md`). Delete the prototype's
label-matching router in `index.html` — it maps `'Blog' → culture` and `'Gallery' → about`,
which are wrong, and it breaks the moment a label is edited.

Footer link targets not yet built (`/journal`, `/gallery`, `/travellers-information`,
`/terms`) are phase 3. Until they exist they must not appear in `SiteSettings.footer` —
`content:validate` fails the build on an unresolvable href.

## Metadata

Every route exports `generateMetadata` drawing on `Seo` from its entity, falling back to
`SiteSettings.defaultSeo`: title template `%s — Lotus Peak`, description, canonical,
OpenGraph with the hero image at 1200×630, `twitter:card="summary_large_image"`.

Structured data: `TouristTrip` + `Offer` on trip detail, `TravelAgency` on `/about` and in the
root layout, `BreadcrumbList` on trip detail, `FAQPage` on the trip FAQ.

`sitemap.ts` enumerates the six routes plus every published trip slug, with `lastModified`
from `updatedAt`. `robots.ts` allows everything except `/admin` and `/api`.
