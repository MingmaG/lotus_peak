# 01 — Architecture

## 1. Layering

Four layers. Dependencies point downward only; a violation is a build error via the
`import/no-restricted-paths` ESLint rule.

```
┌───────────────────────────────────────────────────────────┐
│  app/            routes, layouts, metadata, route handlers │
├───────────────────────────────────────────────────────────┤
│  src/sections/   page sections composed from DS + motion   │
│  src/design-system/   presentational components + tokens   │
│  src/motion/          effects (client)                     │
├───────────────────────────────────────────────────────────┤
│  src/content/    domain schema + ContentRepository         │
├───────────────────────────────────────────────────────────┤
│  src/content/providers/   file · payload · sanity · prisma │
│  src/lib/                 env · mail · images · seo        │
└───────────────────────────────────────────────────────────┘
```

Hard rules:

- `src/design-system/**` imports **nothing** from `src/content/**`. Components take props,
  not domain objects. This is what keeps the design system portable back into the design
  project and testable without a database.
- `app/**` never imports from `src/content/providers/**`. It calls `getContent()`.
- `src/content/providers/**` is the only place a CMS or database SDK may be imported.
- `process.env` appears in exactly one file: `src/lib/env.ts`.
- Nothing imports from `design-source/**`. It is a reference snapshot, excluded from
  `tsconfig.json` and from the Next build.

## 2. Tree

```
lotuspeak/
├── app/
│   ├── layout.tsx                   <html>, fonts, tokens, motion.css, MotionRoot
│   ├── globals.css                  imports tokens + motion css
│   ├── (site)/
│   │   ├── layout.tsx               NavBar, Dignities, Halo, Footer, InquiryDrawer
│   │   ├── page.tsx                 Home
│   │   ├── trips/page.tsx           Trip index
│   │   ├── trips/[slug]/page.tsx    Trip detail
│   │   ├── about/page.tsx
│   │   ├── culture/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── (admin)/
│   │   └── admin/[[...segments]]/   Payload admin — only when the payload provider is active
│   └── api/
│       ├── enquiries/route.ts       POST, rate-limited
│       └── revalidate/route.ts      POST, CMS webhook, signature-verified
├── src/
│   ├── design-system/
│   │   ├── tokens/{fonts,colors,typography,spacing,motion,base}.css
│   │   ├── core/        Button Badge Divider Eyebrow SiteIcon Tooltip WindowFrame
│   │   ├── forms/       Input Select Checkbox Radio Switch FilterChip
│   │   ├── navigation/  NavBar Footer Tabs
│   │   ├── journey/     TrekCard Itinerary Reflection
│   │   ├── feedback/    InquiryDrawer Toast
│   │   ├── primitives/  Disclosure  (new — see audit B12)
│   │   └── index.ts
│   ├── motion/
│   │   ├── motion.css               keyframes + reveal classes + globals
│   │   ├── ScrollBroker.tsx         the single scroll listener + rAF loop
│   │   ├── usePrefersReducedMotion.ts
│   │   ├── useInView.ts  useParallax.ts  useScrollProgress.ts  useElementHeight.ts
│   │   ├── Reveal.tsx  Parallax.tsx  Band.tsx  Strip.tsx  Split.tsx
│   │   ├── ScrollCue.tsx  ShadowArt.tsx  Dignities.tsx  Halo.tsx
│   │   └── index.ts
│   ├── sections/
│   │   ├── home/      Hero Purpose TripGrid Destinations Seasons Reflections
│   │   ├── trip/      TripHero SectionNav Overview Facts Highlights Itinerary …
│   │   ├── about/  culture/  contact/
│   │   └── shared/    Section KeraRule Centered Fact
│   ├── content/
│   │   ├── schema/    trip.ts destination.ts season.ts culture.ts reflection.ts
│   │   │              page.ts settings.ts media.ts enquiry.ts index.ts
│   │   ├── repository.ts            the ContentRepository interface
│   │   ├── index.ts                 getContent() factory + per-request memo
│   │   ├── cache.ts                 tag names, revalidate windows
│   │   └── providers/
│   │       ├── file/     payload/     sanity/     strapi/     prisma/
│   └── lib/
│       ├── env.ts  seo.ts  images.ts  mail/  ratelimit.ts  analytics.ts  log.ts
├── content/                          seed data for the file provider
│   ├── trips/*.mdx   destinations.json   seasons.json   culture/*.mdx
│   ├── reflections.json   pages/*.mdx   settings.json
├── public/assets/                    fonts, imagery, illustrations, icons, ornaments, textures
├── docs/{specs,audit}/
├── design-source/                    imported reference (excluded from build)
└── tests/{unit,e2e}/
```

## 3. Rendering strategy

| Surface | Strategy | Reason |
| --- | --- | --- |
| All six marketing pages | Static (`generateStaticParams` + ISR, `revalidate: 3600`) | Content changes rarely; the site must be fast on a 4G connection in Bhutan and abroad |
| Trip detail | Static per slug, revalidated by tag on CMS webhook | Four pages today, tens later |
| Enquiry POST | Route handler, `runtime: 'nodejs'`, dynamic | Needs mail + rate limiting |
| Admin | Fully dynamic, `noindex` | Payload owns it |

**Server components by default.** A page fetches its content on the server and renders the
copy into the HTML. Only motion wrappers and interactive widgets are client components. This
is what makes audit finding B4 a hard rule: if `Reveal` hid its children by default, the
server-rendered copy would be invisible and the strategy would be pointless.

Client component boundary, precisely:

```tsx
// app/(site)/trips/[slug]/page.tsx — server
const trip = await getContent().trips.bySlug(params.slug)
return (
  <TripHero trip={trip}>          {/* client: parallax */}
    <Reveal delay={240}>          {/* client wrapper */}
      <h1>{trip.title}</h1>       {/* server-rendered text, inside a client wrapper */}
    </Reveal>
  </TripHero>
)
```

Passing server-rendered children *into* a client wrapper keeps the text in the initial HTML.
Never move the content into the client component itself.

## 4. State

There is very little. Enumerated so nobody reaches for a store:

| State | Where it lives |
| --- | --- |
| Current route, current trip | Next router. Delete the prototype's `localStorage['lp-route']` (audit B13) |
| Trip filter on `/trips` | URL search param `?type=meditation` — shareable, server-filterable |
| Itinerary expand/collapse | `useState` in the itinerary client component |
| FAQ / season disclosure | `useState` in `Disclosure` |
| Inquiry drawer open | React context in `(site)/layout.tsx`, so any CTA can open it |
| Nav scrolled, nav height | `ScrollBroker` subscriber + a `--nav-h` custom property |
| Form submission | `useActionState` over a server action |
| Toast | The same layout-level context as the drawer |

No Redux, Zustand or Jotai. If a fifth item appears here, revisit — not before.

## 5. Configuration

`src/lib/env.ts` is the only reader of `process.env`. It parses with Zod at module load and
throws on a bad config at build time rather than at request time.

```ts
export const env = z.object({
  NODE_ENV:        z.enum(['development','test','production']),
  SITE_URL:        z.string().url(),
  CONTENT_SOURCE:  z.enum(['file','payload','sanity','strapi','prisma']).default('file'),
  DATABASE_URL:    z.string().optional(),      // required when the provider needs it
  DATABASE_KIND:   z.enum(['postgres','mysql','sqlite','mongodb']).optional(),
  PAYLOAD_SECRET:  z.string().min(32).optional(),
  SANITY_PROJECT_ID: z.string().optional(),
  SANITY_DATASET:  z.string().optional(),
  REVALIDATE_SECRET: z.string().min(32),
  RESEND_API_KEY:  z.string().optional(),
  ENQUIRY_TO:      z.string().email(),
}).superRefine(requireProviderConfig).parse(process.env)
```

`requireProviderConfig` enforces the cross-field rules — `CONTENT_SOURCE=payload` requires
`DATABASE_URL`, `DATABASE_KIND` and `PAYLOAD_SECRET`; `sanity` requires the project id and
dataset — so a misconfigured deploy fails loudly and immediately.

## 6. Build and tooling

- **pnpm**, Node 20+, TypeScript `strict` with `noUncheckedIndexedAccess`.
- **ESLint** flat config: `next/core-web-vitals`, `@typescript-eslint`,
  `eslint-plugin-jsx-a11y`, plus the layering rule in §1 and a custom rule banning
  `addEventListener('scroll'` outside `src/motion/ScrollBroker.tsx` (audit B10).
- **Stylelint** with a custom rule rejecting raw hex colours and raw `ms`/`s` durations
  outside `src/design-system/tokens/` — the token rule in `CLAUDE.md` §1, enforced.
  Not yet wired; inline style objects need an ESLint rule rather than Stylelint to cover them.
- **Vitest** for units, **Playwright** for e2e including the no-JS and reduced-motion suites.
- **CI**: typecheck → lint → stylelint → unit → build → e2e → Lighthouse budget.

## 7. Deployment

Vercel is the assumed target (Next-native ISR and image optimisation), but nothing in the
codebase may depend on it:

- Images through `next/image` with the default loader; a `loader.ts` shim is kept so a
  self-hosted or Cloudflare deployment can swap it.
- ISR through `revalidateTag`, which works on any Node host.
- No Vercel KV/Blob/Postgres imports. Rate limiting uses an adapter (`src/lib/ratelimit.ts`)
  with an in-memory implementation for dev and a Redis one for production.

A `Dockerfile` with `output: 'standalone'` ships from day one and is built in CI, so the
self-hosting path stays real rather than theoretical.
