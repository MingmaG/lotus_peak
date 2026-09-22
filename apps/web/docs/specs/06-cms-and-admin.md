# 06 — CMS and admin panel

> "…and a CMS admin panel integrateable."

The site must work with **no CMS at all**, and must accept one without any page changing.
That is achieved by treating the admin panel as a *mountable surface* rather than a
dependency, sitting behind the same `ContentRepository` interface as everything else.

## 1. Three independent decisions

The architecture keeps these separate. Most projects fuse them and then cannot change any one
of them.

| Decision | Options | Set by |
| --- | --- | --- |
| Where content is stored | file · Postgres · MySQL · SQLite · MongoDB · hosted CMS | `DATABASE_KIND` + the provider |
| How content is read | `file` · `prisma` · `payload` · `sanity` · `strapi` | `CONTENT_SOURCE` |
| Where content is edited | nothing · Payload at `/admin` · a hosted CMS's own studio | `ADMIN_PANEL` |

`ADMIN_PANEL=none` is a valid production configuration, and the site is fully functional in
it. That is the test that the coupling is genuinely absent.

## 2. Default: Payload, embedded

Payload is the recommended default because it is the only option that satisfies both axes at
once:

- It runs **inside this Next.js app** — same deployment, same domain, no second service.
- Its `local API` is callable during static generation, so `generateStaticParams` and page
  rendering do not go over HTTP.
- It ships its own database adapters — `@payloadcms/db-postgres`, `db-mongodb`, `db-sqlite` —
  so switching the database under the CMS is one import and one connection string.
- Collections are TypeScript, so they can be generated from, and checked against, the Zod
  schemas in `src/content/schema/`.

Mounting:

```
app/(admin)/admin/[[...segments]]/page.tsx     Payload admin UI
app/(admin)/api/[...slug]/route.ts             Payload REST/GraphQL
payload.config.ts                              collections, access, hooks
```

The whole `(admin)` group is excluded from the build when `ADMIN_PANEL !== 'payload'`, via a
route-group guard and a webpack alias that stubs the Payload imports. `/admin` is `noindex`,
`nofollow`, and excluded from the sitemap.

### Collections

One per entity in `04-content-model.md`: `trips`, `destinations`, `seasons`, `culture`,
`reflections`, `pages`, `media`, `enquiries`, plus the `settings` global.

- `trips.itinerary`, `highlights`, `included`, `excluded`, `faq` are Payload **array fields** —
  the editor gets drag-to-reorder, which matters for the itinerary.
- `pages.blocks` uses Payload **blocks**, one per `Block` type in the content model. Editors
  compose the home page from the ten section types and cannot invent an eleventh.
- `media` uses Payload's upload collection with `imageSizes` matching the `next/image`
  breakpoints, and **`alt` is required** — enforced at the CMS, not just in validation.
- Rich text is Lexical; the adapter converts Lexical → `RichText`. The editor's toolbar is
  restricted to what the renderer supports: paragraph, h2/h3, bold, italic, link, list, quote.
  No colour, no font size, no alignment — those are the design system's job.
- `enquiries` is read/update-only in the admin (status: new → replied → archived). Nobody
  creates one by hand.

### Access control

Roles: `admin` (everything), `editor` (content, no users or settings), `viewer` (enquiries
only — for whoever answers them). Enquiries carry personal data: restrict `read` to `admin`
and `viewer`, never expose the collection through the public API, and set a retention hook
that archives after 24 months.

### Publishing

Drafts + versions on `trips`, `culture` and `pages`. An `afterChange` hook POSTs to
`/api/revalidate` with `{ entity, slug }` and the HMAC signature, so publishing updates the
static site within seconds. Preview mode uses Next's `draftMode()` with a signed token;
`draftMode` forces the uncached provider path.

## 3. Alternative: a hosted CMS

When someone prefers Sanity, Strapi or Directus, the change is:

1. `CONTENT_SOURCE=sanity`, `ADMIN_PANEL=none` (editors use the vendor's studio).
2. Write/enable the adapter (`05-data-layer.md` §5).
3. Point the vendor's webhook at `/api/revalidate` with the shared secret.
4. Model the content in the vendor's schema to match `04-content-model.md`.

No page, section or design-system file changes. The Payload directory is simply not built.

Sanity's studio can also be embedded at `/studio` if a single domain is wanted — the same
route-group pattern as `(admin)`.

## 4. Migration between providers

`scripts/content-migrate.ts` reads through **any** `ContentRepository` and writes through a
provider-specific writer:

```
pnpm content:migrate --from=file --to=payload
pnpm content:migrate --from=payload --to=sanity --dry-run
```

Because the read side is the shared interface, the migrator only needs a writer per
destination. It is idempotent on `slug`, reports a diff before writing, and re-uploads media
with dimensions and alt text intact.

This is how phase 1's `content/` seed becomes the initial CMS dataset, and it is what makes
"we could move off this CMS" a true statement rather than an intention.

## 5. Editor experience

The people using this are a small team in Bhutan, not CMS specialists. The admin must be
boring:

- Field labels use the words the business uses: "Journey", not "Trip entity"; "Rest day", not
  "`rest: boolean`".
- Help text on anything with a convention: price is a number, formatting is automatic; the
  region line is built from the destinations, in order, so do not type it.
- The itinerary editor shows day numbers computed live, including the renumbering that
  happens when a rest day is inserted.
- Image upload demands alt text and shows the focal point control, because the site crops
  images hard under parallax.
- A "View on site" link on every published document, and a preview button on drafts.
- Publish-blocking validation mirrors `content:validate` (`04-content-model.md` §4) so the
  same rules apply in the CMS and in CI, with the CMS explaining *why* in plain words.

## 6. Non-negotiables

- No CMS SDK import outside `src/content/providers/<name>/`.
- No CMS type in a component prop, a page, or a section.
- The `file` provider keeps working forever. If a change breaks it, the change is wrong.
- Admin routes are `noindex` and excluded from the sitemap.
- `ADMIN_PANEL=none` builds, passes e2e, and deploys. CI proves it on every PR.
