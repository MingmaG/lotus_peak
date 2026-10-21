# Deploying

Two applications, one database, one bucket. The website is the only thing the
public reaches; the panel can sit behind whatever access control the office
prefers.

```
                     ┌──────────────────────────┐
  visitors ────────▶ │ apps/web      (static)   │
                     └────────────┬─────────────┘
                                  │ /api/public/site/*
                     ┌────────────┴─────────────┐
  the office ──────▶ │ apps/admin    (node)     │ ──▶ Postgres
                     └────────────┬─────────────┘
                                  └───────────────▶ S3 / MinIO
```

## The order matters

**The admin panel must be running and migrated before the website builds.** The
website asks it for the journey and journal slugs during
`generateStaticParams`, so a build against a panel that is down produces a site
with no journeys in it — successfully, and without complaint. The root
`npm run build` runs admin then web for this reason; keep that order in CI.

A sensible pipeline:

```bash
npm ci
npm run db:deploy -w @lotuspeak/admin     # migrate. Never db:push
npm run build:admin
# start the panel, wait for /api/health
npm run build:web
```

## One VM, with PM2

No nginx. Two Node processes under PM2, bound to loopback, with TLS and the
public hostname terminated by whatever sits in front — a Cloudflare tunnel, a
load balancer, an Apache you already run. Postgres and RustFS are yours and
are not started by any of this.

```
          ┌─────────────────────────── your VM ───────────────────────────┐
  TLS ───▶│ :6010  lotuspeak-web ──▶ :6011 lotuspeak-admin ──▶ Postgres   │
          │                                      └─────────▶ RustFS :9000 │
          └───────────────────────────────────────────────────────────────┘
                                   ▲
            a browser fetches photographs from RustFS directly,
            over its own public URL — never through these two
```

### Once, to set the box up

```bash
# Node 20+ and PM2
node -v                                   # >= 20.9
npm i -g pm2

git clone <repo> /srv/lotuspeak && cd /srv/lotuspeak
npm ci

cp deploy/env/admin.env.example apps/admin/.env
cp deploy/env/web.env.example   apps/web/.env
bash scripts/generate-secrets.sh          # paste into both; the pairs must match
$EDITOR apps/admin/.env apps/web/.env
```

Every variable is commented in those two files. The four that fail quietly
rather than loudly are worth checking twice:

| admin | web | if they differ |
| --- | --- | --- |
| `SITE_REVALIDATE_SECRET` | `REVALIDATE_SECRET` | publishing stops reaching the site; nothing says so for an hour |
| `PREVIEW_SECRET` | `PREVIEW_SECRET` | every preview link is refused |
| `MAIL_REPORT_SECRET` | `MAIL_REPORT_SECRET` | mail goes out, the Email screen stays empty |
| `MEDIA_PUBLIC_URL` | `MEDIA_PUBLIC_URL` | prose figures vanish from journal entries |

### The database

You have the URL and a dump. Restore it — the dump carries the schema, the
content and Prisma's own ledger of which migrations have run, so there is
nothing to migrate afterwards:

```bash
# on the machine holding the dump
pg_dump --no-owner --no-privileges -Fc "$DEV_DATABASE_URL" -f lotuspeak.dump

# on the VM
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" lotuspeak.dump
npx prisma migrate status --schema apps/admin/prisma/schema.prisma   # expect: up to date
```

Starting from empty instead is `npm run db:deploy && npm run db:seed` — the
checked-in migrations reproduce the schema exactly, so both routes land in the
same place. Either way **never `db:push`** at a database the office uses.

### The media library

The dump and the bucket are two halves of one thing: a `media` row names its
renditions, the bytes live under `media/<id>/<width>.webp`. Restore one
without the other and every page renders perfectly with a broken image in
every frame — nothing errors, because nothing on the server fetches them.

See *Moving the media library* below.

### Start it

```bash
./deploy/deploy.sh --migrate      # first run; drop --migrate if you restored a dump
pm2 save && pm2 startup           # survive a reboot — run the line it prints
```

`deploy/deploy.sh` exists for one reason: it builds the panel, *restarts* it,
waits for `/api/health`, and only then builds the website. The website asks the
panel for its slugs while it builds, so building it against a panel that is
down or still running the last release gives you a site with missing pages,
successfully and without complaint.

### Day to day

```bash
pm2 status
pm2 logs lotuspeak-web --lines 100
pm2 reload lotuspeak-admin          # restart and re-read .env (see below)
./deploy/deploy.sh                  # deploy a new release
```

`reload` rather than `restart` because it re-reads the environment, but in
`fork` mode it is still a restart with a second or two of refused connections
in the middle — PM2's zero-downtime reload only exists in `cluster` mode, which
this deployment deliberately does not use.

One process each, `fork` mode, and that is deliberate — see the comment in
`deploy/ecosystem.config.js`. The website's rendered pages and the tags they
were cached under live in that process, so a publish clears the worker that
answered it; with two workers the office corrects a price, reloads, sees it
change, reloads again and watches it change back. Scaling this site means a
second box and a shared cache, not a second worker.

Set `LOTUSPEAK_BIND=0.0.0.0` only if the thing forwarding to these is on
another machine, and know that the panel is then on the internet on 6011 with
only its own sign-in in front of it.

## Moving the media library

`deploy/media-sync.mjs` moves objects between any two S3-compatible stores —
MinIO here, RustFS there, identical calls. It never touches the database.

```bash
# 1. pull every object out of the current store into a folder
node deploy/media-sync.mjs export
#    → deploy/media-export/media/<id>/400.webp, 800.webp, …

# 2a. push the folder into the RustFS bucket
node deploy/media-sync.mjs upload \
  --endpoint http://127.0.0.1:9000 --bucket lotuspeak-media \
  --access-key KEY --secret-key SECRET

# 2b. or upload deploy/media-export/ by hand, through the RustFS console or mc.
#     Keep the paths: the website asks for <bucket>/media/<id>/<width>.webp
#     exactly, and a folder dropped one level deep is a bucket full of
#     unreachable objects.
mc mirror deploy/media-export/ rustfs/lotuspeak-media/

# 3. check it
node deploy/media-sync.mjs verify \
  --endpoint http://127.0.0.1:9000 --bucket lotuspeak-media \
  --access-key KEY --secret-key SECRET \
  --public-url https://s3.example.com/lotuspeak-media
```

`export` is resumable — it skips what is already on disk, so an export that
died at object 800 of 900 does not refetch the first 800. `upload` takes
`--dry-run`. Nothing about the target is defaulted, on purpose: inheriting
`S3_ENDPOINT` from a developer's `.env` would point the upload at the
development MinIO and report complete success having moved nothing.

**The bucket needs anonymous read on objects.** Every call the script makes is
authenticated; a visitor's browser is not, and a private bucket answers 403 to
it while every one of those calls succeeds. The symptom is every photograph on
the site broken with nothing in any log to explain it, which is why `verify`
fetches one object with no credentials at all and fails if it cannot:

```bash
mc anonymous set download rustfs/lotuspeak-media
```

Uploads write `Cache-Control: public, max-age=31536000, immutable`, the same
header the panel writes, which is safe because a rendition key is never
reused — replacing the photograph behind a media row writes new keys.

### Renditions

The panel builds five WebP renditions per photograph at upload, and the site
fetches them straight from the bucket: nothing is resized on the VM and
`/_next/image` is never requested. If a photograph is missing its smaller
sizes — an upload made while a worker was down, or a library seeded with
`db:seed`, which skips them — rebuild them after the objects are in place:

```bash
npm run media:rebuild -w @lotuspeak/admin
```


## Environment

Both apps read `.env`. `.env.example` in each is the list, with a note on every
variable that can be got wrong quietly.

Four secrets, from `bash scripts/generate-secrets.sh`. Two of them live in both
files and **must match**:

| admin | web | if they differ |
| --- | --- | --- |
| `SITE_REVALIDATE_SECRET` | `REVALIDATE_SECRET` | publishing stops reaching the site; nothing says so until the hourly refresh |
| `PREVIEW_SECRET` | `PREVIEW_SECRET` | every preview link is refused |

`env.ts` refuses to start the panel in production with a secret still set to
`change-me`. That is the only such check — the two above fail silently by
nature, which is why they are in a table.

Set for real, per environment:

- `SITE_URL` (admin) and `NEXT_PUBLIC_SITE_URL` (web) — the website's public
  origin, no trailing slash. Canonicals, the sitemap, the feed, every JSON-LD
  `@id`, and the panel's "View on site" links are built from these.
- `CONTENT_API_URL` (web) — where the panel is, from the build machine.
- `MEDIA_PUBLIC_URL` (both) — where photographs are served from. The panel
  builds every image URL from its copy, so that is the one that decides what a
  browser fetches; the website's copy only allowlists the hosts an `<img>`
  inside prose may point at. The bucket behind it has to allow anonymous read,
  which `deploy/media-sync.mjs verify` is the quickest way to find out.
- `DATABASE_URL` (admin only, and never on the website).
- `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `MAIL_OFFICE_TO` — **on the
  website, not the panel.** The website sends an enquiry's two messages itself,
  so that a panel which is down, restarting or mid-deploy cannot stop an
  enquiry reaching the office. Unset means messages are rendered and reported
  rather than sent, which is the right default everywhere except production.
  The domain in `MAIL_FROM` must be verified in Resend; that DKIM signature is
  the whole reason mail goes through a provider rather than SMTP from the box,
  whose IP has no sending reputation. `MAIL_OFFICE_TO` is comma-separated and
  is the one to check after a deploy: unset means nobody is written to.
- `MAIL_REPORT_SECRET` (both, and they must match) — lets the website write
  what it sent to the panel's Email screen. Unset on either side means mail
  goes out and none of it is recorded: no log, no delivery events, and an
  allowance that never counts down. The panel says so on Settings, on the Email
  screen and in `/api/health`.
- `RESEND_WEBHOOK_SECRET` — from the webhook's page in the Resend dashboard,
  beginning `whsec_`. Add a webhook pointing at
  `https://<the panel>/api/webhooks/resend`, subscribed to `email.delivered`,
  `email.bounced`, `email.complained`, `email.opened` and
  `email.delivery_delayed`. Without it every message in the Email screen stops
  at "Sent", which only means Resend accepted it — a bounce is never recorded,
  and a wrong address looks exactly like a traveller who did not reply. Unset
  means the endpoint refuses delivery notices rather than accepting unsigned
  ones from anybody who finds the URL.
- `MAIL_DAILY_CAP` — how many messages a day may be handed to the provider,
  100 by default, which is Resend's free plan. Over the line a message is
  recorded as *Skipped* against the enquiry it belongs to, so the office can
  see who went unanswered; a provider refusal names nobody. `/api/health` says
  how much of the day's allowance is spent.

## Storage

`STORAGE_DRIVER=s3` is what MinIO is for in development: the driver is
identical, so what works locally works against RustFS, Supabase Storage,
Cloudflare R2 or AWS. The bucket needs public read on objects; uploads go
through the panel. RustFS and MinIO address a bucket by path rather than by
subdomain, so keep `S3_FORCE_PATH_STYLE=true` for both — false against either
produces a 301 to a hostname that does not resolve, and the error reads as a
network failure rather than a configuration one.

Getting the objects from one store to another is *Moving the media library*
above.

`STORAGE_DRIVER=local` writes to `apps/admin/storage` and serves through
`/api/storage`, which is fine on a single box — but then `ADMIN_PUBLIC_URL`
must be set to the panel's real public origin, because it is what every image
URL on the website gets resolved against.

## Publishing and cache

Publishing sends a signed `POST` to `SITE_URL/api/revalidate` naming the tags
that changed. For that to work the panel must be able to reach the website over
HTTP — if they are in separate networks, that is the one hole to open.

If it cannot, nothing breaks: `CONTENT_REVALIDATE_SECONDS` (an hour) is the
backstop, and the office simply waits. Do not shorten it to paper over a
blocked webhook; fix the webhook.

## After the first deploy

```bash
npm run db:seed -w @lotuspeak/admin        # only on an empty database
npm run media:rebuild -w @lotuspeak/admin  # AVIF and JPEG renditions
```

Then sign in as the seeded owner and change the password — it is
`SEED_OWNER_PASSWORD`, and its default is in the repository.

## Checks that are worth doing once, on the real thing

- `curl -s https://<site>/ | head` — does the homepage carry its content in the
  HTML, without JavaScript.
- The build's route table: every website route `○` or `●`, none `ƒ`.
- `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/feed.xml` all answer.
- Publish a change in the panel and reload the page it affects.
- Send an enquiry through the real form and confirm the row, the office email
  and the acknowledgement. Reply to the office copy: it must go to the
  traveller, not back to the company's own address.
- `/api/health` — `mail` and `mailWebhook` both `ok`. The second is the one a
  deploy forgets, and nothing else reports it.
- A preview link from the panel, and the same URL in a private window — the
  second must be refused.
