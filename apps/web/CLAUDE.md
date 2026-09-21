# Lotus Peak — project rules

Marketing site for **Lotus Peak Tours & Travel**, a Bhutanese company running small-group
mindfulness, meditation, festival and trekking journeys.

The visual design is already finished and lives in a Claude design-system project
(`60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`, "Bhutan Sanctuary"). This app is the
**production Next.js implementation** of that design, and the design is approved: match
it, do not improve it. Read `docs/specs/` before writing code, and the monorepo's
`../../CLAUDE.md` for anything that crosses into the admin panel.

---

## 1. Non-negotiables

These come from the design system's own rules. Breaking one is a bug, not a style choice.

- **Grounds are white.** Page and section backgrounds are `#FFFFFF` (`--paper`) or
  `#F7F7F6` (`--paper-2`). Never cream, beige or warm-tinted grounds (`#EFE8DD`, `#F7F3EC`).
  Dark sections use `--pine` / `--pine-2`.
- **No Claude/Anthropic brand colours, type or visual language** anywhere in this project.
- **One typeface**: Commissioner, self-hosted, weights 100–900. No second family, no
  Google Fonts CDN.
- **Saffron (`--saffron`) is the single CTA colour**, at most one filled button per section.
  Outline and ghost carry everything else.
- **Never hardcode a colour, size, duration or easing.** Everything goes through the CSS
  custom properties in `src/design-system/tokens/`. If a value you need is not a token,
  add a token — do not inline a hex or a `ms`.
- **Motion mimics breath, never urgency.** Durations are long (`--dur-reveal: 1.8s`,
  `--dur-breath: 8s`). Never add bounce, spring overshoot, or anything under `--dur-quick`.
- **`prefers-reduced-motion` is honoured by every effect**, in CSS *and* in JS. Any hook that
  writes `transform` on scroll must bail out when the query matches.
- **No star ratings, no urgency badges, no countdowns, no "only 2 left".** Testimonials are
  `Reflection` components — a quote and a quiet attribution.

## 2. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router, React 19, TypeScript `strict` | RSC for content pages, islands for effects |
| Styling | CSS custom properties + inline style objects | Ported 1:1 from the design project, whose hover states are JS-state-driven; Tailwind would add a translation layer that drifts |
| Motion | Hand-written hooks over `IntersectionObserver` + one shared rAF broker | The prototype's effects are cheap and specific; a general animation library would not reproduce them and would cost more |
| Content | Provider-agnostic repository (`src/content`) | See §4 |
| Admin | `apps/admin`, a separate Next app, reached over HTTP | See §4 |
| Validation | Zod at every provider boundary | Content from an API is untrusted input |
| Email | Sent by the admin panel, not here | This app has no mail credential |

**npm workspaces**, Node 20+. Run everything from the repo root.

## 3. Layout

```
app/                      routes only — thin, no business logic
  api/                    enquiry intake, revalidation, preview, 404 beacon
  sitemap.ts robots.ts llms.txt feed.xml
src/
  design-system/          tokens + presentational components (ported 1:1 from the design project)
  sections/               page sections composed from design-system + motion
  motion/                 the effects system — Reveal, Parallax, Band, Strip, Split, Dignities
  content/                domain types, the repository interface, the api and file providers
  seo/                    the JSON-LD graph for each page type
  lib/                    env, seo helpers, the asset registry, enquiry submission
docs/specs/               the build specification — authoritative
docs/audit/               findings carried over from the prototype
design-source/            imported reference from the design project (do not import at runtime)
```

**`design-source/` is reference material, never a build input.** Nothing under `app/` or
`src/` may import from it.

## 4. Where the content comes from

Read `docs/specs/05-data-layer.md` before touching any of it.

**Pages never touch a database, and this app holds no credential for one.** They call
`getContent()` → a `ContentRepository`. Two providers implement it:

- `api` (the default) reads `apps/admin`'s public endpoints over HTTP. Everything a
  visitor sees is a row the office can edit.
- `file` reads `src/content/data/` and needs nothing running. It is the fixture, and it
  is also the proof that no page is coupled to a provider — if a page only works under
  `api`, something has leaked.

`CONTENT_SOURCE` picks between them. No provider type ever leaks past
`src/content/providers/`; the domain types in `src/content/types.ts` are what pages see.

Rules:
- **Never import `@prisma/client`, `@/lib/db`, or anything from `apps/admin`.** The HTTP
  boundary is the architecture, not an inconvenience.
- **Never memoise content on a module-scope closure.** The closure outlives the request,
  so publishing stops reaching the site while every cache header still says it worked.
  This happened once and took a while to see.
- Both providers implement the **whole** interface or neither does — no partial providers
  with silent `undefined` returns.
- Adding a field means: `packages/api-contracts` → the admin's serialiser → `types.ts` →
  both providers → the component. In that order, because the first step makes the rest
  fail to compile until they are done.
- Anything a component needs must travel **on the record**. A module-level registry keyed
  by image path worked on the server and silently produced `alt=""` on every client
  component — see `docs/CUTOVER.md`.

## 5. Effects

`src/motion/` is the heart of the site and the part most likely to be quietly broken.
`docs/specs/03-motion-and-effects.md` is the contract; `docs/audit/effects-integration.md`
lists what was already wrong in the prototype and must not be reproduced.

Standing rules:

- **Never ship a `Reveal` that renders `opacity: 0` on the server.** The prototype does, which
  makes the whole page invisible without JS and to crawlers that do not run it. Entrance
  animation is opt-in via a `motion-ready` class set on `<html>` after hydration; the
  no-JS state is the finished state.
- **One scroll broker.** `useScrollBroker` owns the single `scroll` listener and the single
  `requestAnimationFrame` loop; `Parallax`, `Strip`, `Dignities` and the section spy all
  subscribe to it. Do not add a bare `window.addEventListener('scroll', …)`.
- **Effects are client components; content is not.** Keep `"use client"` on the motion
  wrapper, not on the page that uses it, so trip copy still renders on the server.
- `Dignities` is a single page-wide fixed layer rendered once in the site layout — never
  per page, never more than one.
- Section motif art (`ShadowArt`) and the page-wide `Dignities` layer must never both be
  visible in the same viewport. That is why the prototype retired `Shadow`; when you
  reinstate motifs, pick one system per section and say which in the component.

## 6. Content and voice

Copy is part of the design. When you write or edit user-facing text:

- Plain, calm, specific. Short sentences. No marketing superlatives.
- British spelling ("travellers", "programme", "honour").
- Prices as `US$ 4,500`. Altitudes as `3,120 m`. Durations as `11 days`.
- Bhutanese terms are used unglossed where the context carries them (dzong, tshechu, kira,
  gho, thongdrel, Lam, Rinpoche, Jomzo, Zorig Chusum) and explained in a `Tooltip` where
  they are not (SDF).
- **Never type a contact detail into a component.** The phone number, the WhatsApp
  number, the address, the email and every social link come from the settings the layout
  already has. Three hardcoded copies of the phone number survived into this app and had
  to be hunted down when the office changed it; the fourth is on you.

## 7. Working agreements

- **Port one component at a time**, verify it against the design project, then move on.
  Do not bulk-convert the prototype JSX.
- When the design and this repo disagree, **the design project wins** — fetch the current
  file rather than trusting `design-source/`, which is a snapshot.
- `npm run typecheck && npm run lint` before declaring anything done — and understand
  that neither of them can tell you a page still says what it said. For anything that
  moves data, diff the prerendered HTML (`scripts/compare-html.mjs`); for anything with a
  form in it, open a browser.
- Every new route needs `generateMetadata`, JSON-LD via `src/seo/`, an entry in the
  sitemap, a reduced-motion pass, and a check that it is still `○` in the build output.
- Images go through `next/image` with explicit `width`/`height` and a real `alt`
  (decorative ones get `alt=""` and `aria-hidden`).
- Reduced motion must switch off **transitions**, not only animations. Almost all of this
  design's movement is a transition written as an inline style, which a media query
  cannot override one at a time — `src/motion/motion.css` turns them off together.
- Do not add a dependency for something a 30-line hook does.

## 8. Commands

From the repo root, which brings the database and the admin panel up too:

```
npm run dev              # both apps — this one on :6010
npm run build            # admin then web, in that order
npm run typecheck
npm run lint
```

In this workspace:

```
npm run assets:check     # which brand assets are still placeholders
npm run assets:build     # regenerate image renditions and font subsets
node scripts/compare-html.mjs <before> <after>
```

There is no test runner here yet. What stands in for one is the prerendered-HTML diff
and the browser; `docs/CUTOVER.md` is the record of what that caught.
