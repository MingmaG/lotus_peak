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
- `MEDIA_PUBLIC_URL` (both) — where photographs are served from. The website's
  `next.config.mjs` builds `images.remotePatterns` from it; get it wrong and
  every image is a 500 whose message names the hostname rather than the config.
- `DATABASE_URL` (admin only, and never on the website).
- `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `MAIL_OFFICE_TO` — unset means
  enquiries are recorded and the message logged rather than sent, which is the
  right default everywhere except production. The domain in `MAIL_FROM` must be
  verified in Resend; that DKIM signature is the whole reason mail goes through
  a provider rather than SMTP from the box, whose IP has no sending reputation.
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
identical, so what works locally works against Supabase Storage, Cloudflare R2
or AWS. The bucket needs public read on objects; uploads go through the panel.

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
