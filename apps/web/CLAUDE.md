# Lotus Peak — project rules

Marketing site for **Lotus Peak Tours & Travel**, a Bhutanese company running small-group
mindfulness, meditation, festival and trekking journeys.

The visual design is already finished and lives in a Claude design-system project
(`60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`, "Bhutan Sanctuary"). This repo is the
**production Next.js implementation** of that design. Read `docs/specs/` before writing code.

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
| Admin | Pluggable; Payload CMS mounted at `/admin` is the default | See §4 |
| Validation | Zod at every provider boundary | Content from a CMS is untrusted input |
| Email | Adapter interface, Resend adapter by default | Enquiries are the only conversion path |

Package manager is **pnpm**. Node 20+.

## 3. Layout

```
app/                      routes only — thin, no business logic
  (site)/                 public marketing site
  (admin)/                CMS admin, when the Payload provider is active
  api/                    enquiry intake, revalidation webhooks
src/
  design-system/          tokens + presentational components (ported 1:1 from the design project)
  sections/               page sections composed from design-system + motion
  motion/                 the effects system — Reveal, Parallax, Band, Strip, Split, Dignities
  content/                schema, repository interface, provider adapters, factory
  lib/                    env, seo, images, mail, analytics
content/                  seed data for the file provider
docs/specs/               the build specification — authoritative
docs/audit/               findings carried over from the prototype
design-source/            imported reference from the design project (do not import at runtime)
```

**`design-source/` is reference material, never a build input.** Nothing under `app/` or
`src/` may import from it.

## 4. The two axes of pluggability

The whole point of the architecture. Read `docs/specs/05-data-layer.md` and
`docs/specs/06-cms-and-admin.md` before touching either.

**Database-agnostic.** Pages never touch a database. They call
`getContent()` → a `ContentRepository`. Swapping Postgres for MongoDB, or a
file-based seed for a hosted CMS, is one env var and one adapter file. Adapters map their
own shape into the domain types in `src/content/schema/` and validate with Zod on the way
out. No provider type ever leaks past `src/content/providers/`.

**CMS-agnostic.** The admin panel is an opt-in surface, not a dependency. Payload is the
default because it runs inside this Next app and carries its own database adapters
(Postgres / MongoDB / SQLite), which satisfies both axes at once — but `SanityProvider`,
`StrapiProvider` and `DirectusProvider` are equally first-class and must stay buildable.

Rules:
- Never `import` a CMS SDK outside `src/content/providers/<name>/`.
- Never reference `process.env` outside `src/lib/env.ts`.
- Every new provider implements the **whole** `ContentRepository` interface or fails at
  construction — no partial providers with silent `undefined` returns.
- Adding a field means: schema → every provider → seed data → the component. In that order.

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
- Real contact details: `+975 17984485`, `info@lotuspeak.org`.

## 7. Working agreements

- **Port one component at a time**, verify it against the design project, then move on.
  Do not bulk-convert the prototype JSX.
- When the design and this repo disagree, **the design project wins** — fetch the current
  file rather than trusting `design-source/`, which is a snapshot.
- Run `pnpm typecheck && pnpm lint && pnpm test` before declaring anything done.
- Every new route needs `generateMetadata`, an entry in the sitemap, and a reduced-motion
  pass.
- Images go through `next/image` with explicit `width`/`height` and a real `alt`
  (decorative ones get `alt=""` and `aria-hidden`).
- Do not add a dependency for something a 30-line hook does.

## 8. Commands

```
pnpm dev            # next dev
pnpm build          # next build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest
pnpm test:e2e       # playwright, includes the reduced-motion + no-JS suites
pnpm content:seed   # load content/ seed data into the active provider
```
