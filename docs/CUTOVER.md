# The cutover: what changed when the content moved into the database

`apps/web` read its content from TypeScript modules in `src/content/data/`. It
reads it from the admin panel's public API now. This is what that changed, and
why each item is a decision rather than a bug.

The check was not "it builds". A build succeeds with an empty journeys index,
with a missing paragraph, with `undefined` where a price was. Every page was
prerendered before the change and after it, and the two sets were compared —
`scripts/compare-html.mjs` for the markup, and a rendered-text diff for what a
visitor actually reads.

**Result: 21 of 21 pages render identical text.**

---

## What the diff caught

Four things, all of them real, and none of them findable by reading the code.

### 1. Alt text on every photograph became `alt=""`

`src/lib/assets.ts` held one description per photograph keyed by its path, and
the design system looked it up: `altFor(src)`. When the photographs moved into
the media library their `src` became `…/media/<id>/1600.webp` — a key that
table has never heard of.

A module-level registry populated by the content provider fixed it on the
server and not on the client, which is the part worth remembering: `TrekCard`,
`Strip`, `Parallax` and both heroes are `'use client'`, and a client component
reads the *client bundle's* copy of that module, which the server's fetch never
touched. **Alt text that only exists on the server ships as `alt=""`.**

So the description travels on the record now — `Trip.heroAlt`,
`Destination.imageAlt`, a fourth element on each gallery tuple — and the file
provider fills the same fields from the static table, so both providers hand
out the same shape.

### 2. The itinerary lost a day on three journeys

Day numbers are computed from position rather than stored, because an
itinerary with an arrival day inserted at the front is one where every stored
number after it is wrong. The first implementation counted only the days that
print a number, so the Jomolhari trek's rest day at Jangothang did not consume
one and the walk to Lingshi after it became Day 6 instead of Day 7. A
fourteen-day journey ended on Day 12.

**A rest day takes a number; it just does not print one.** These are dates on a
traveller's calendar, not entries in a list.

### 3. Every destination reordered its journeys

`trip_on_destinations` had one `sortOrder`, set from the route — and the join is
read from both ends. A journey lists its places in the order the route passes
through them; a destination lists its journeys in the order the office wants
them offered, which is an editorial decision with nothing to do with anybody's
route. One column cannot carry both, so there are two: `routeOrder` and
`offerOrder`.

### 4. Paro was given a journey it had deliberately left off

With the join built from routes, the festival journey appeared on the Paro page
— its route goes through Paro. The content it moved from does not list it
there. That is an editorial choice, so `offerOrder` is nullable and null means
**passes through, not offered here**.

---

## What is different on purpose

### Photographs are served from the media library

Before: `/assets/imagery/taktshang.webp`, a file in `public/`.
After: the media store's URL for the largest WebP rendition.

This is the whole point. The photograph is a row the office can replace, crop,
re-describe and reorder, and the site follows it without an edit. The files in
`public/assets/imagery` are now the seed's source and nothing reads them at
runtime.

### `<head>` element order moved

Metadata is resolved from an async fetch now, so Next emits `<title>` and the
meta tags at a different point in the stream relative to the font preloads. The
tags and their contents are identical; only their order in the document
changed, and nothing depends on it.

### Pages are a little larger

The flight payload carries absolute image URLs and the alt text that used to be
compiled into the bundle. Between 0 and 17%, most of it on the gallery, which
is twenty-eight photographs.

---

## What did not change

- No component, section, motion hook or token was edited for this. The
  `ContentRepository` interface was the seam and it held: the swap is one
  provider directory and one case in the factory.
- The file provider still works, is still the fixture, and still passes. Run it
  with `CONTENT_SOURCE=file` and no admin panel.
- All five region lines — including "Paro · Jomolhari", which is why
  `Trip.regions` is a column beside the destination join.

---

## Running the check again

```bash
cd apps/web
rm -rf .next && npm run build
mkdir -p /tmp/before && (cd .next/server/app && find . -name '*.html' | tar cf - -T -) | tar xf - -C /tmp/before
# …make the change…
rm -rf .next && npm run build
node scripts/compare-html.mjs /tmp/before .next/server/app --ignore-media
```

`rm -rf .next` matters. Next reuses its fetch cache between builds, and a build
that reuses it is a build comparing the old API's answers with themselves —
which is how two of the four findings above were briefly reported as fixed
while they were not.
