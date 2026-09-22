# 09 — Performance, SEO, accessibility, testing

This site is image-heavy, effect-heavy, and read largely on phones over unreliable
connections. The design's restraint only survives if the engineering is disciplined.

## 1. Performance

### Budgets (enforced in CI, on the Home and Trip detail routes)

| Metric | Budget | Measured |
| --- | --- | --- |
| LCP | ≤ 2.5s | Lighthouse CI, Moto G4 / 4G throttle |
| CLS | ≤ 0.1 | " |
| INP | ≤ 200ms | " |
| JS transferred (route) | ≤ 130 KB gzipped | `next build` output, asserted |
| Fonts | ≤ 120 KB total | two preloaded weights |
| Largest image on the wire | ≤ 250 KB | asset pipeline check |

A PR that breaks a budget fails. Raising a budget requires a note in the PR saying what it
bought.

### Images

- `next/image` everywhere, with real `width`/`height` from `MediaAsset` — required, and the
  main defence against CLS.
- AVIF first, WebP fallback. Sizes 640 / 1024 / 1600 / 2400.
- `priority` on exactly one image per route: the hero. Everything else lazy.
- `sizes` set accurately on every parallax image — they are full-bleed, so a wrong `sizes`
  downloads a 2400px file for a phone.
- `blurDataURL` on the hero and the trip cards; not on parallax layers, where the
  `scale(1.14)` overscan makes a blur-up visibly wrong at the edges.
- The four `Dignities` illustrations render at 9% opacity behind a radial mask — encode them
  at low quality, ≤ 1200px, and lazy-load panels 1–3.

### JavaScript

- Server components by default; `"use client"` only on the motion wrappers and the seven
  interactive components listed in `02-design-system.md` §3.
- No animation library. The effects are ~200 lines of hooks (`03-motion-and-effects.md`).
- Dynamic-import the provider modules so an unused CMS SDK never enters the bundle
  (`05-data-layer.md` §2).
- The `(admin)` group is excluded from the site build entirely when Payload is not the
  active panel.

### Runtime

- One scroll listener and one rAF loop for the whole page (audit B10).
- Reads and writes batched into separate phases — no layout thrash.
- `will-change` set only while animating, cleared after.
- At most six active parallax subscribers per viewport; the broker warns in dev beyond that.

## 2. SEO

- Static generation with ISR; every marketing page is fully rendered HTML including all copy.
  **This is why audit B4 is a launch blocker** — a `Reveal` that ships `opacity: 0` gives a
  crawler a page of invisible text, and gives a real user on a slow phone a blank screen.
- `generateMetadata` on every route; title template `%s — Lotus Peak`; canonical URLs.
- OpenGraph + Twitter cards with the hero at 1200×630.
- JSON-LD: `TravelAgency` (root), `TouristTrip` + `Offer` (trip detail), `FAQPage` (trip FAQ),
  `BreadcrumbList` (trip detail).
- `sitemap.ts` from real data, `lastModified` from `updatedAt`. `robots.ts` disallows
  `/admin` and `/api`.
- Semantic headings: one `h1` per page, no level skips. The prototype uses `h2` inside `Band`
  and `h3` in cards — verify the resulting outline per route, it is easy to break when
  sections are reordered by a CMS.
- Alt text is required content, not a lint fix. Decorative layers get `alt=""` +
  `aria-hidden="true"`.

## 3. Accessibility — WCAG 2.2 AA

### Contrast

Check these specifically; the design runs close in places:

- `--text-muted` (#5E5A53) on `--paper` (#FFFFFF) — comfortable.
- `--text-faint` (#8A857C) on white — **~3.3:1**. Acceptable for large text only. It is used
  for the `Dignities` caption and image captions; keep those ≥ 18.66px bold or 24px regular,
  or darken the token.
- Copy over hero imagery — the scrims (`rgba(31,29,26,.38)` + gradient) must be verified per
  image, not assumed. Test each hero at its actual crop.
- `--sky-deep` (#15618F) as the primary CTA fill takes white text — 6.7:1. `--sky` (#7AC2FE)
  is a fill and large-shape colour only; never set type in it.
- `--saffron` (#D98A2B) as a secondary CTA fill takes `--ink` text, not white. Do not invert it.
- `--gold` is a line colour only; never use it for text.

### Motion

- Everything still under `prefers-reduced-motion: reduce`: no parallax, no strip scrub, no
  dignity cycling, no breathe, no halo. The site must be *pleasant* still, not obviously
  degraded — this is a supported state, not a fallback.
- No effect flashes more than three times per second (nothing here comes close).

### Keyboard and focus

- Visible focus everywhere: `2px solid var(--focus-ring)` with `3px` offset, from
  `tokens/base.css`. Never remove it.
- `InquiryDrawer`: focus trap, restore on close, `Escape`, `inert` behind.
- Trip detail section nav is a real `<nav>` of buttons that move focus to the target section,
  not just the scroll position.
- Skip link to `#main` as the first focusable element.
- Every `Disclosure` toggle pairs `aria-expanded` with `aria-controls` (the prototype pairs
  neither).

### Structure

- Landmarks: `header`, `nav`, `main` (with `id="main"`), `footer`.
- `Strip` is `aria-label="Gallery"`; under reduced motion it is a real horizontal scroll
  region with `tabindex="0"` so keyboard users can reach it.
- The Dzongkha caption in `Dignities` is `lang="dz"` and `aria-hidden` — the rail's buttons
  already announce each dignity by name and meaning — but the font must still cover it, there
  and in the plate, where the same text is read out. See `03-motion-and-effects.md` §5.
- The rail's caption is a real button with an `aria-label` naming the dignity and what it
  stands for; the four markers under it are `aria-hidden` decoration, not controls. The plate
  is a modal dialog: focus moves into it, Tab is trapped, Escape closes it and focus returns
  to the word that opened it.

## 4. Browsers

Last two versions of Chrome, Edge, Firefox and Safari, plus iOS Safari 16+ and Chrome Android.

Watch for:
- `mix-blend-mode: luminosity` and `multiply` with `mask-image` — the `ShadowArt` and
  `Dignities` combination. Safari has historically composited these differently; check on a
  real device, not just a simulator.
- `aspect-ratio` on `<img>` inside flex — fine everywhere current, but `Strip` relies on it.
- `grid-template-rows: 0fr → 1fr` transitions — Chrome 129+, Firefox 130+, Safari 17.4+.
  Older browsers snap open instead of animating, which is an acceptable degradation.
- `scrollbar-width: none` on `Strip` — add `::-webkit-scrollbar { display: none }`.
- 100vh on iOS — use `100svh` for the heroes, or they overflow under the browser chrome.

## 5. Testing

| Layer | Tool | What |
| --- | --- | --- |
| Unit | Vitest | Formatters, `RichText` renderer, every provider mapper, the enquiry schema |
| Contract | Vitest | The provider conformance suite (`05-data-layer.md` §6), run per provider |
| Component | Vitest + Testing Library | Every design-system component's variant matrix + `axe` |
| E2E | Playwright | The suites below |
| Visual | Playwright screenshots | Six routes × 3 viewports, motion disabled for stability |
| Budgets | Lighthouse CI | Home and trip detail |

E2E suites that exist specifically because of the audit:

1. **No-JS** — JavaScript disabled: every heading and paragraph on `/` and `/trips/valleys`
   is visible and correctly positioned; the contact form submits and confirms (B4, §3 of the
   forms spec).
2. **Reduced motion** — emulated preference: no `transform` mutation after load, no rAF loop,
   `Strip` does not move on vertical scroll, all content visible (B5, B6).
3. **One listener** — exactly one `scroll` listener on `window` after load, on every route
   (B10).
4. **Dignities** — exactly one instance in the DOM; the index advances 0→3 across a full
   scroll of `/` (B7), and the named word in the corner changes with it.
5. **Dignity plate** — open it from the corner word with the keyboard alone; focus lands
   inside, Tab does not leave it, Escape closes it and focus returns to that word. Under
   reduced motion it is gone within a frame rather than after the 1.75s exit.
6. **Nav offset** — `--nav-h` matches the measured nav height at 360 / 768 / 1440, scrolled
   and unscrolled (B8).
7. **Keyboard enquiry** — complete and submit an enquiry from `/trips/valleys` using only the
   keyboard, including opening and closing the drawer.
8. **Provider parity** — the same visual tests pass with `CONTENT_SOURCE=file` and
   `CONTENT_SOURCE=prisma` against the same seed.

## 6. Monitoring

- Real-user vitals reported to the analytics adapter (privacy-respecting; no cookies, no
  personal data).
- Server-action errors and mail failures logged with a correlation id and alerted — a lost
  enquiry is the worst failure this site can have.
- `/api/health` returns the provider's `health()`, for uptime checks.
- A weekly job runs `content:validate` against production content and reports drift —
  unresolvable refs, missing alt text, trips published without an itinerary.
