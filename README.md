# Lotus Peak Tours & Travel

Two applications and four shared packages. `apps/web` is the public website;
`apps/admin` is the panel the Thimphu office runs it from. Everything a visitor
reads — every journey, price, paragraph, photograph, phone number and menu item
— is a row somebody can edit, and there is no content in the website's source.

```
apps/web      the marketing site          :6010
apps/admin    the admin panel + the API   :6011
packages/     api-contracts, seo, email, media
docker/       Postgres :6012, MinIO :6013 (console :6014)
```

## Getting it running

You need Docker and Node 20+.

```bash
npm install
cp apps/admin/.env.example apps/admin/.env
cp apps/web/.env.example apps/web/.env
bash scripts/generate-secrets.sh        # prints the four secrets; paste them in
npm run db:up                           # Postgres and MinIO
npm run db:deploy                       # migrations
npm run db:seed                         # the real site's content
npm run dev
```

The website is on <http://localhost:6010> and the panel on
<http://localhost:6011>. The seed makes one account, `owner@lotuspeak.local`,
with the password from `SEED_OWNER_PASSWORD` (default `Owner@12345` — change it
before anything is reachable from outside your machine).

`npm run db:seed` skips the AVIF and JPEG renditions so that a first run takes a
minute rather than ten; `npm run media:rebuild -w @lotuspeak/admin` fills them
in when you want to look at real image loading.

Three of the four secrets are shared between the two apps and must match:
`SITE_REVALIDATE_SECRET` ↔ `REVALIDATE_SECRET`, and `PREVIEW_SECRET` on both
sides. A mismatch does not raise anything — publishing simply stops reaching the
website until the hourly refresh catches up, which is a bad afternoon.

## How the two halves meet

The website holds **no database credential**. It reads `/api/public/site/*` from
the admin panel over HTTP, which is what makes it deployable as a static site
next to a panel that lives somewhere else entirely, and what stops a bug in a
marketing page from being able to read the enquiry table.

```
        publish ──HMAC──▶ POST /api/revalidate ──▶ revalidateTag()
       ┌─────────┐                                 ┌──────────┐
       │  admin  │ ◀── GET /api/public/site/* ──── │   web    │
       │  :6011  │ ──── POST /api/public/enquiries │  :6010   │
       └─────────┘                                 └──────────┘
            │                                           ▲
       Postgres :6012                            visitors, crawlers
```

Publishing anything sends a signed invalidation naming the tags that changed,
so a corrected price is live in about a second. `CONTENT_REVALIDATE_SECONDS`
(an hour) is the backstop for a push that never arrived, not the mechanism.

Because the website asks the panel for its journey and journal slugs at build
time, **the admin panel must be running when the website builds.**

## Everything is prerendered

Every page of the website is static — `○` or `●` in the build output, never
`ƒ`. That is not an optimisation, it is the deliverable: a travel site is read
by people on hotel wifi in Paro and by crawlers that do not wait. Anything that
turns a route dynamic is a regression, and `npm run build:web` is where you find
out. `docs/CUTOVER.md` describes the two occasions this was broken by accident
and how each was caught.

## Commands

| | |
| --- | --- |
| `npm run dev` | both apps, with the database brought up first |
| `npm run build` | admin then web — in that order, because web reads admin |
| `npm run typecheck` / `npm run lint` | both workspaces |
| `npm run db:up` / `db:down` | the Docker services |
| `npm run db:reset` | throws the volume away and re-seeds. Destructive |
| `npm run db:migrate` | a new migration, after editing `schema.prisma` |
| `npm run db:studio` | Prisma Studio |

## Where to read next

| | |
| --- | --- |
| `docs/PLAN.md` | what was built, in the order it was built |
| `docs/CUTOVER.md` | moving the content into the database, and the seven defects that only a prerendered-HTML diff could find |
| `deploy/README.md` | putting it somewhere |
| `CLAUDE.md` | the rules that hold across both apps |
| `apps/web/CLAUDE.md` | the design system's own non-negotiables |

## Ports

Chosen to sit away from the usual 3000/5432/9000 so this can run beside other
projects. All four are in `docker/docker-compose.yml` and the two `.env` files.

| | |
| --- | --- |
| 6010 | website |
| 6011 | admin panel and the public API |
| 6012 | Postgres |
| 6013 | MinIO (S3) |
| 6014 | MinIO console — `minioadmin` / `minioadmin` |
