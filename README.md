# Lotus Peak

The Lotus Peak Tours & Travel website — Next.js 15, App Router, TypeScript.

Built from the Claude design-system project "Bhutan Sanctuary"
(`60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run typecheck
npm run assets:check # which brand assets are still placeholders
```

## Where things are

| Path | What |
| --- | --- |
| `app/` | Routes. Thin — no business logic |
| `src/design-system/` | Tokens and the 20 components, ported 1:1 from the design project |
| `src/motion/` | The effects: Reveal, Parallax, Band, Split, Strip, Dignities, ShadowArt |
| `src/sections/` | Page sections composed from the two above |
| `src/content/` | Domain types, `ContentRepository`, the file provider |
| `docs/specs/` | The build specification |
| `docs/audit/` | What the prototype got wrong, and what was done about it |
| `design-source/` | Reference snapshot. Never imported at runtime |

## Two things are outstanding

**1. Brand assets are not exported yet.** Fonts, photography, illustrations, icons,
ornaments and textures still live only in the design project. Until they are exported into
`public/assets/`, `app/assets/[...path]/route.ts` serves tinted SVG placeholders at the right
shapes — so every layout, aspect ratio, mask and parallax crop is already correct, and the
real art drops straight in over them. Files in `public/` are served ahead of routes, so no
code changes when they land. Run `npm run assets:check` to see what is still missing, and
delete that route once nothing is.

Fonts return 404 rather than a placeholder, so `@font-face` falls back to the system stack
instead of rendering tofu.

**2. Three itineraries need sign-off.** The design project only has day-by-day content for
the sacred-valleys journey; the prototype silently shows it under all four titles. The
itineraries, highlights, inclusions and FAQ for `meditation`, `festival` and `jomolhari` in
`src/content/data/trips.ts` were drafted from each journey's own description, region list,
length and altitude. **They are plausible, not authoritative** — Lotus Peak must check them
before launch.

## Backend and CMS

There is none yet, by design. Content is TypeScript modules read through a
`ContentRepository`, so pages never touch a data source directly. Adding Postgres, Payload or
Sanity later is one adapter in `src/content/providers/` and one case in the factory — no page,
section or component changes. `docs/specs/05-data-layer.md` and `06-cms-and-admin.md` describe
exactly how.

Enquiries currently POST to `/api/enquiries`, which validates, rate-limits, checks a honeypot
and hands the record to the provider, which logs it. The mail adapter is phase 5.
