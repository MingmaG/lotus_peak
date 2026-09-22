# 05 — Data layer (database-agnostic)

> "Make sure the system can be scaled using different databases."

The mechanism is one interface and one factory. Pages depend on the interface; the database
is an implementation detail resolved from a single env var at startup.

## 1. The interface

`src/content/repository.ts`. This is the whole public surface of content in the app.

```ts
export interface ContentRepository {
  readonly name: ProviderName

  trips: {
    list(opts?: { type?: TripType; limit?: number; status?: Status }): Promise<Trip[]>
    bySlug(slug: string): Promise<Trip | null>
    slugs(): Promise<string[]>                       // for generateStaticParams
  }
  destinations: { list(): Promise<Destination[]> }
  seasons:      { list(): Promise<Season[]> }
  culture:      { list(): Promise<CultureArticle[]>; bySlug(s: string): Promise<CultureArticle | null> }
  reflections:  { list(opts?: { tripSlug?: string; featured?: boolean; limit?: number }): Promise<Reflection[]> }
  pages:        { bySlug(slug: PageSlug): Promise<Page | null> }
  media:        { byId(id: string): Promise<MediaAsset | null>; byIds(ids: string[]): Promise<MediaAsset[]> }
  settings:     { get(): Promise<SiteSettings> }

  enquiries: {
    create(input: EnquiryInput): Promise<{ id: string }>
  }

  health(): Promise<{ ok: boolean; detail?: string }>
}
```

Design notes, each load-bearing:

- **Read-shaped.** Everything except `enquiries.create` is a read. The site is a
  publication; authoring happens in the CMS, not through this interface. This is what keeps
  adapters small — a read-only Sanity adapter is ~150 lines.
- **`byIds` is plural** so adapters can batch. A naive per-id fetch against a remote CMS is
  the difference between one request and forty on the home page.
- **No `find`, no query builder, no filter DSL.** Every method is a named use case the site
  actually has. A generic query interface would leak database semantics into pages and would
  be impossible to implement faithfully across SQL, document stores and REST CMSs.
- **`slugs()` is separate from `list()`** because `generateStaticParams` wants ids only and
  some providers can answer that far more cheaply.
- **`health()`** backs `/api/health` and the startup check.

Adding a use case means adding a method here and implementing it in **every** provider. That
friction is deliberate — it is what stops the interface drifting into a query language.

## 2. The factory

`src/content/index.ts`:

```ts
let instance: ContentRepository | null = null

export function getContent(): ContentRepository {
  if (instance) return instance
  instance = createProvider(env.CONTENT_SOURCE)
  return instance
}

function createProvider(name: ProviderName): ContentRepository {
  switch (name) {
    case 'file':    return createFileProvider()
    case 'prisma':  return createPrismaProvider()
    case 'payload': return createPayloadProvider()
    case 'sanity':  return createSanityProvider()
    case 'strapi':  return createStrapiProvider()
  }
}
```

Every provider module is imported **dynamically** inside its own case so that a build with
`CONTENT_SOURCE=file` does not bundle the Sanity or Payload client. Optional peer
dependencies stay optional.

`getContent()` is the only way anything reaches content. There is an ESLint rule forbidding
imports from `src/content/providers/**` outside that directory.

## 3. Caching

Caching lives in a wrapper, not in the adapters, so it behaves identically whichever database
is behind it.

```ts
const cached = withCache(provider, {
  'trips.list':      { tags: ['trips'],                  revalidate: 3600 },
  'trips.bySlug':    { tags: (slug) => ['trips', `trip:${slug}`], revalidate: 3600 },
  'settings.get':    { tags: ['settings'],               revalidate: 3600 },
  // …
})
```

Implemented with `unstable_cache` / `cache()`. Two layers:

1. **Per-request memo** (`React.cache`) — the home page asks for settings from the nav, the
   footer and the SEO helper; that must be one call.
2. **Cross-request ISR** with tags. `/api/revalidate` verifies an HMAC signature from the CMS
   webhook and calls `revalidateTag`. Body: `{ entity: 'trip', slug?: string }`.

`enquiries.create` is never cached and always runs on the Node runtime.

## 4. The providers

### `file` — default, phase 1

Reads `content/` at build time: MDX frontmatter + body for trips, culture and pages; JSON for
destinations, seasons, reflections, media and settings. MDX body → `RichText` at build, not at
request. `enquiries.create` writes newline-delimited JSON to `.data/enquiries.ndjson` in dev
and is a no-op in production (mail is the real delivery path — see `08-forms-and-enquiries.md`).

Zero infrastructure. The site is fully functional, deployable and demo-able before any
database exists. It stays supported forever as the test fixture and the reference
implementation.

### `prisma` — Postgres, MySQL, SQLite

One adapter covers three databases, because that is Prisma's job. `DATABASE_KIND` selects the
Prisma datasource provider; `DATABASE_URL` points at it.

Schema notes:
- `Trip.itinerary`, `highlights`, `included`, `excluded`, `faq` are `Json` columns. They are
  ordered, trip-scoped value objects, never queried independently — normalising them buys
  nothing and costs five joins on the hottest page.
- `Trip ↔ Destination` is many-to-many through an explicit join table with an `order` column;
  the region line is ordered ("Paro · Bumthang · Trongsa").
- `Localised<string>` columns are `Json`, holding `{"en": "…"}` today.
- Indexes on `(status, order)` for every listable entity and a unique index on `slug`.
- Migrations are checked in; CI runs `prisma migrate deploy` against a throwaway database and
  then the provider conformance suite (§6).

### `mongo`

Only if a document store is actually wanted. Prisma's MongoDB connector covers it without a
separate adapter — prefer that. A hand-written driver adapter is a last resort, and if written
must pass the same conformance suite.

### `payload` — local API, no HTTP

Payload runs **inside this Next app**, so the adapter calls `payload.find()` directly rather
than over HTTP — no network hop, no serialisation, works during static generation. Payload
brings its own database adapter (`@payloadcms/db-postgres`, `-mongodb` or `-sqlite`), which is
how this single choice satisfies both the database and CMS axes at once. See
`06-cms-and-admin.md`.

### `sanity` — hosted, GROQ

Read-only. One GROQ query per method, with projections that resolve references and image
dimensions in the same request (Sanity's `asset->metadata.dimensions` gives us
`MediaAsset.width`/`height` for free). Portable Text → `RichText` in the adapter. Uses the
CDN client for production reads and the live client for preview.

### `strapi` / `directus` — REST

Both are straightforward REST adapters with `populate`/`fields` tuned per method. Listed to
prove the interface is not shaped around any one CMS; write them when someone asks.

## 5. Writing an adapter

1. `src/content/providers/<name>/index.ts` exports `create<Name>Provider(): ContentRepository`.
2. `mappers.ts` converts the provider's shapes into domain types. **Every mapper ends in
   `Schema.parse()`** — a CMS payload is untrusted input.
3. Add the case to the factory and the env-var union in `src/lib/env.ts`, plus its
   cross-field requirements in `requireProviderConfig`.
4. Add it to the conformance suite matrix (§6).
5. Document its env vars and its webhook setup in `docs/providers/<name>.md`.

Nothing in `app/`, `src/sections/` or `src/design-system/` changes. If a provider forces a
change outside `src/content/providers/`, the interface is wrong — fix the interface, not the
page.

## 6. Conformance suite

`tests/content/conformance.spec.ts` runs the **same** assertions against every configured
provider, seeded from `content/`:

- Every method returns schema-valid data.
- `trips.list()` is ordered by `order`, excludes drafts, and `type` filtering is exact.
- `bySlug` returns `null` for an unknown slug — never throws, never returns a partial.
- `byIds` preserves input order and silently drops missing ids.
- Every `Ref` in returned data resolves through the same provider.
- `list({ limit: n })` returns at most `n`.
- `enquiries.create` returns an id and the record is retrievable where the provider supports
  reads.
- `health()` is truthful — it fails when the database is stopped.

CI runs it against `file` and `prisma`+SQLite on every PR, and against `prisma`+Postgres and
`payload` nightly. A provider that has not passed it is not wired into the factory.

## 7. What this buys

| Change | Work required |
| --- | --- |
| SQLite → Postgres | `DATABASE_KIND` + `DATABASE_URL`, run migrations |
| File seed → a real CMS | `CONTENT_SOURCE`, run the import script, set a webhook |
| Add a second CMS for a sister site | One adapter directory, one factory case |
| Add a `Trip.videoTour` field | Schema → each provider → seed → component. Pages untouched |
| Move from Vercel to self-hosted | Nothing in this layer |
