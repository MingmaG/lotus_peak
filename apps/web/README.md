# @lotuspeak/web

The Lotus Peak Tours & Travel website — Next.js 15, App Router, React 19,
TypeScript. Built from the Claude design-system project "Bhutan Sanctuary"
(`60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`).

Start it from the repo root (`npm run dev`), which brings up the database and
the admin panel this app reads from. See the root `README.md` for setup and
`CLAUDE.md` in this folder for the design rules, which are not suggestions.

```bash
npm run dev          # http://localhost:6010
npm run build        # every route must come out ○ or ●, never ƒ
npm run typecheck
npm run lint
npm run assets:check # which brand assets are still placeholders — currently none
```

## Where things are

| Path | What |
| --- | --- |
| `app/` | Routes. Thin — no business logic |
| `src/design-system/` | Tokens and the 20 components, ported 1:1 from the design project |
| `src/motion/` | The effects: Reveal, Parallax, Band, Split, Strip, Dignities, ShadowArt |
| `src/sections/` | Page sections composed from the two above |
| `src/content/` | Domain types, `ContentRepository`, and the `api` and `file` providers |
| `src/seo/` | The JSON-LD graph each page type emits |
| `docs/specs/` | The build specification |
| `docs/audit/` | What the prototype got wrong, and what was done about it |
| `design-source/` | Reference snapshot. Never imported at runtime |

## Content

Everything on this site is a row in the admin panel's database, read over HTTP
through `/api/public/site/*`. This app holds no database credential, and
`CONTENT_SOURCE=file` swaps in the fixture under `src/content/data/` — which is
how you can build and browse the whole site with nothing else running, and how
you find out if a page has quietly coupled itself to a provider.

`docs/../../docs/CUTOVER.md` (repo root, `docs/CUTOVER.md`) describes the move
from static modules to the database and the seven defects that only a
prerendered-HTML diff could find. Read it before changing anything that touches
the content layer.

## Still outstanding

**Three itineraries need sign-off.** The design project only ever had
day-by-day content for the sacred-valleys journey. The itineraries, highlights,
inclusions and FAQ now in the database for the meditation, festival and
Jomolhari journeys were drafted from each journey's own description, region
list, length and altitude. **They are plausible, not authoritative** — Lotus
Peak must check them before launch. They are all editable in the panel under
Journeys.
