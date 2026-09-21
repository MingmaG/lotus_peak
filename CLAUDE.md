# Lotus Peak — working rules

A monorepo for **Lotus Peak Tours & Travel**, a Bhutanese company running small-group
mindfulness, meditation, festival and trekking journeys. `apps/web` is the public
website, `apps/admin` is the panel the office runs it from.

Read `README.md` first for how to start it, and `apps/web/CLAUDE.md` before touching
anything a visitor looks at — the visual design is approved and its rules live there.

---

## 1. The three that are not negotiable

**Nothing a visitor reads is in the source.** Every journey, price, itinerary day,
paragraph, photograph, phone number, address, social link and menu entry is a row the
office can edit. If you are about to type a company detail into a component, stop: it
belongs in `CompanyProfile`, `ContactChannel`, `SocialLink` or `Setting`, and it is
already there. Three hardcoded copies of the phone number were removed once; do not add
a fourth.

**The website has no database credential, and must never be given one.** It reads
`/api/public/site/*` over HTTP. That boundary is what lets the site deploy as static
files beside a panel that lives somewhere else, and it is what stops a bug in a
marketing page from being able to read the enquiry table. Never import `@prisma/client`,
`@/lib/db` or anything under `apps/admin/src/server/` from `apps/web`.

**Every page of the website is prerendered.** `npm run build:web` marks each route `○`,
`●` or `ƒ`. An `ƒ` is a regression and the build is where you find out — not a code
review. `force-dynamic` on `not-found.tsx` once turned eleven static routes dynamic,
which no amount of reading the diff would have shown. If a page needs a request, it
almost certainly needs middleware or a client component instead.

## 2. Layout

```
apps/web        the site. Routes in app/, everything else in src/
apps/admin      the panel, the API the site reads, and Prisma
packages/
  api-contracts types only — the shape of what crosses the HTTP boundary
  seo           one JSON-LD @graph per page, llms.txt
  email         the transactional templates, as table HTML
  media         rendition widths, srcset, focal point
docker/         Postgres and MinIO for development
docs/           PLAN.md, CUTOVER.md
deploy/         deployment notes
```

`packages/api-contracts` is the contract between the two apps. When a field changes
shape, change it there first — both sides then fail to compile, which is the point.
`adults` was written out by hand on both sides once, drifted to `string` on one of them,
and every enquiry carrying a party size was silently refused.

## 3. Data

Prisma, Postgres, migrations checked in. `apps/admin/prisma/schema.prisma` is the only
schema.

- A schema change is a migration (`npm run db:migrate`), never `db:push` on anything
  but a scratch database.
- `Json` columns — a journal body, a page's sections — are parsed by Zod on the way in
  **and** on the way out (`src/server/schema/blocks.ts`). Postgres will not do it for
  you, and a malformed block must render as nothing rather than take a published page
  down.
- Stored shapes reference media by id; wire shapes carry the serialised image. Never
  store a serialised image — correcting one piece of alt text would mean rewriting every
  row that used the photograph.
- Deletes are soft (`deletedAt`) wherever the office might want the row back. Sessions
  are revoked, not deleted: "where am I signed in" is a question about history too.

## 4. Auth and permissions

Two JWT secrets, not one. The access token is stateless and lasts fifteen minutes; the
refresh token is checked against a `Session` row and lasts thirty days. That fifteen
minutes is the longest a deactivated account, a changed role or a revoked session can
lag.

- Permissions are `<resource>.<action>` strings on the role, carried in the token, and
  checked with `can()`, which understands implication.
- The middleware is a gate, not an authoriser: it runs on the edge, has no Prisma, and
  only decides whether a request may reach a route at all. Permission checks belong in
  the route, where the row can be read.
- **`refresh()` writes a cookie, so it may only be called from a route handler or a
  server action.** A Server Component that writes a cookie throws and takes the page
  with it. `hasRefreshCookie()` is the read-only half.

## 5. The seam between publishing and the site

Publishing sends a signed invalidation (`x-lotuspeak-signature`) naming the tags that
changed. `CONTENT_REVALIDATE_SECONDS` is the backstop for a push that never arrived, not
the mechanism.

- A revalidation must never fail a save. The office correcting a price should not see an
  error because the website is restarting.
- **Do not memoise content on a module-scope closure in `apps/web`.** It outlives the
  request, so publishing stops reaching the site while every cache header still says it
  worked. This has happened.
- Preview is a short-lived, path-scoped signed token. It is not "draft mode on".

## 6. Verifying

`npm run typecheck && npm run lint` is the floor, and it is not evidence that anything
works. A build succeeds with an empty journeys index, a missing paragraph and
`undefined` where a price was.

What actually catches things:

- **Prerendered-HTML diffing** (`apps/web/scripts/compare-html.mjs`). Capture the
  rendered text before a change that moves data, compare after. Seven defects were found
  this way and none of them was visible in the code — see `docs/CUTOVER.md`.
- **The browser**, for anything with a form in it. `curl` said the enquiry API was fine
  while the form was announcing "Sent" over a 500 and clearing what the traveller had
  written.
- **The route table** from `npm run build:web`, for the static-rendering invariant.
- Real horizontal scrollability (`window.scrollTo(9999, y)`) for responsive checks.
  `scrollWidth - clientWidth` measures the scrollbar and will lie to you.

## 7. Conventions

- Conventional Commits; `git config commit.template .gitmessage` gives you the types and
  scopes. Commit messages explain *why*, and a fix names the failure it prevents.
- Comments explain decisions, not mechanics. If a line looks wrong and isn't, say why —
  that is what most of the comments in this repo are for.
- British spelling in anything a person reads, including the admin panel.
- In the admin panel, `src/lib/env.ts` is the only place `process.env` is read, and it
  refuses a `change-me` secret in production. On the website, a value read in more than
  one place belongs in `src/lib/env.ts`; one read once, where it means something, does
  not. The layout read `SITE_URL` — the admin panel's variable name, unset on this side
  — for a while, and fell through to the production domain, so every Open Graph URL in
  development pointed at the live site and nothing failed.
- Do not add a dependency for something a thirty-line module does.
- Restart the dev servers after a build: `next build` clears `.next` underneath them and
  they start 404ing their own chunks.
- **Clear `apps/web/.next/cache` after changing the API's shape.** Next keeps fetch
  responses on disk across builds, keyed by URL, for `CONTENT_REVALIDATE_SECONDS` — an
  hour. A build after a contract change otherwise reuses yesterday's payload and either
  renders without the new field or dies on `Cannot read properties of undefined`. It
  looks exactly like a bug in the mapper, and it is not.
