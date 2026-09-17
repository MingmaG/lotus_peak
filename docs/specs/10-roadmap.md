# 10 — Roadmap

Seven phases. Each ends in something runnable, and each has an exit test that CI can check.
Nothing later depends on a decision that has not been made by then.

---

## Phase 0 — Import and scaffold

- `create-next-app` (TypeScript, App Router, no Tailwind), pnpm, Node 20.
- ESLint flat config + the two custom rules (layering, no bare scroll listeners); Stylelint +
  the no-raw-token rule; Prettier; Vitest; Playwright.
- `src/lib/env.ts` with the Zod schema and `requireProviderConfig`.
- **Pull the binary assets** from the design project into `public/assets/` — fonts,
  imagery, illustrations, icons, ornaments, textures (list in `02-design-system.md` §4).
  They are the one thing not yet imported; the design MCP serves binaries one file at a
  time, so script it (`pnpm assets:pull`) or export from the design UI.
- Asset pipeline: TTF → WOFF2, imagery → AVIF/WebP at four widths, `media.json` generated
  with real dimensions.
- `app/globals.css` importing the six token files (already in `design-source/tokens/`).
- Dockerfile with `output: 'standalone'`, built in CI from day one.

**Exit:** `pnpm dev` serves a blank page with Commissioner loaded and every token resolving.

## Phase 1 — Motion system

Built before the components, because every component sits inside it and audit B4 changes how
components render.

- `motion.css` — the five keyframes and three globals rescued from the prototype's page
  `<style>` block (audit B9).
- `ScrollBroker`, `usePrefersReducedMotion`, `useInView`, `useParallax`, `useScrollProgress`,
  `useElementHeight`.
- `Reveal` with the SSR-safe `motion-ready` pattern (B4), `Parallax`, `Band`, `Split`,
  `Strip` (B5, B6), `ScrollCue`, `ShadowArt`, `Dignities` (B7), `Halo`.
- `--nav-h` plumbing (B8).
- A dev route `/_dev/motion` exercising every effect on placeholder content.

**Exit:** e2e suites 1, 2, 3 and 4 from `09-quality.md` §5 pass. This is the phase that
makes "the effects are properly integrated" true, and it is checkable.

## Phase 2 — Design system

- All 21 components + the new `Disclosure`, ported one at a time, each with a
  `.module.css`, typed props, a variant-matrix test and an axe check.
- Form fields extended to forward native attributes (B11), with `id`/`error`/`aria-describedby`.
- `InquiryDrawer` given real dialog semantics.
- `/_dev/ds/<name>` gallery routes, dev-only.

**Exit:** every component renders every variant; axe clean; visual snapshots match the
design project's component cards.

## Phase 3 — Content layer, file provider

- Zod schemas for every entity in `04-content-model.md`.
- `ContentRepository` interface, `getContent()` factory, the caching wrapper.
- `file` provider reading `content/`.
- The prototype's copy authored into `content/` as seed data.
- `RichText` type, renderer and the MDX converter.
- `content:validate` and the conformance suite, running against `file`.

**Exit:** `getContent()` returns schema-valid data for every method; conformance passes.

## Phase 4 — The six pages

- `(site)/layout.tsx` shell — `Dignities`, `Halo`, `NavBar`, `Footer`, drawer + toast context.
- `src/sections/` and the six routes, per `07-pages-and-routing.md`.
- Staging added to `/trips`, `/about` and `/contact` (audit B2, B3).
- `ShadowArt` reinstated on the two dark sections; motif props removed from light ones (B1).
- Metadata, JSON-LD, sitemap, robots.
- Full responsive pass, 360 → 1440+.

**Exit:** all six routes match the prototype at 1440×900 and are coherent at 360px; e2e
suites 5 and 6 pass; Lighthouse budgets met.

## Phase 5 — Enquiries

- `EnquiryInput` schema, the server action, rate limiting, honeypot, timing check.
- Mail interface + Resend, SMTP and console adapters; both messages.
- The three entry points wired to one pipeline.
- Consent, privacy page, retention.

**Exit:** an enquiry submitted from all three surfaces, with and without JS, lands in the
store and in the inbox; keyboard-only e2e passes.

## Phase 6 — Database

- Prisma schema + migrations; `prisma` provider.
- `content:migrate --from=file --to=prisma`.
- Conformance suite green against SQLite in CI and Postgres nightly.
- Provider-parity visual tests (suite 7).

**Exit:** the site builds and serves identically with `CONTENT_SOURCE=file` and
`CONTENT_SOURCE=prisma`, from the same seed, with no page file changed.

## Phase 7 — CMS and admin

- `payload.config.ts` with collections mirroring the schemas, roles, drafts and versions.
- `(admin)` route group, guarded and excluded when `ADMIN_PANEL !== 'payload'`.
- `payload` provider using the local API.
- `/api/revalidate` with HMAC verification; Payload `afterChange` hook; preview mode.
- Editor experience pass (`06-cms-and-admin.md` §5).
- A second adapter — Sanity — written to prove the interface, even if unused in production.

**Exit:** editors publish a trip and see it live within seconds; `ADMIN_PANEL=none` still
builds, passes e2e and deploys.

---

## Launch checklist

- [ ] All twelve items in `docs/audit/effects-integration.md` §C ticked
- [ ] Itinerary, highlights, inclusions and FAQ authored for all four journeys (B14)
- [ ] Privacy page written; consent wording approved
- [ ] Real contact details verified: +975 17984485, info@lotuspeak.org
- [ ] Footer links point only at pages that exist
- [ ] Analytics live and carrying no personal data
- [ ] Enquiry alerting tested end to end, including the mail-failure path
- [ ] Lighthouse budgets met on Home and trip detail
- [ ] Reduced-motion and no-JS passes reviewed by a human, not just by CI
- [ ] Safari/iOS check of the blend-mode + mask layers on a real device
- [ ] `/admin` noindex confirmed; `robots.txt` and sitemap verified in production

## Deferred (phase 8+)

`/journal` (blog), `/gallery`, `/travellers-information`, `/terms` — all four already linked
from the prototype's footer. Culture article detail pages. Dzongkha localisation, for which
the content model is already shaped (`04-content-model.md`). A departures/dates model, only if
the business decides to publish availability — today it deliberately does not.
