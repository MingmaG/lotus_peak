#!/usr/bin/env bash
#
# Build and restart both apps on the VM, in the order that works.
#
# The order is the whole point of this file. The website asks the panel for
# the journey and journal slugs while it builds — `generateStaticParams` is a
# real HTTP call to /api/public/site — so a build against a panel that is
# down, or still running last release's code, produces a site with missing
# pages or yesterday's shape. Successfully. Without complaint.
#
#   ./deploy/deploy.sh              build and restart both
#   ./deploy/deploy.sh --migrate    …and run migrations first
#
# Run it from the repo root as the user that owns the checkout. It does not
# touch the database unless you ask, and never touches the bucket.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

MIGRATE=false
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------

say "Dependencies"
# `npm ci` and not `install`: the lockfile is the record of what was tested,
# and a deploy is the wrong moment to resolve a new minor version of anything.
npm ci

if [ "$MIGRATE" = true ]; then
  say "Migrations"
  # `migrate deploy`, never `db:push`. It applies the checked-in migrations and
  # refuses anything it does not recognise, which is what you want pointed at
  # a database holding the office's work.
  npm run db:deploy
fi

say "Clearing the website's fetch cache"
# Next keeps API responses on disk across builds, keyed by URL, for
# CONTENT_REVALIDATE_SECONDS — an hour. A build straight after a release that
# changed the API's shape otherwise reuses the old payload and either renders
# without the new field or dies on `Cannot read properties of undefined`. It
# looks exactly like a bug in the mapper and it is not.
rm -rf apps/web/.next/cache

say "Building the panel"
npm run build:admin

say "Starting the panel"
# Started before the website builds, and restarted before it builds, so that
# the API the website compiles against is this release's and not the last.
if pm2 describe lotuspeak-admin >/dev/null 2>&1; then
  pm2 reload lotuspeak-admin --update-env
else
  pm2 start deploy/ecosystem.config.js --only lotuspeak-admin
fi

say "Waiting for the panel"
PANEL="${PANEL_HEALTH_URL:-http://127.0.0.1:6011/api/health}"
for attempt in $(seq 1 60); do
  if curl -fsS -m 5 "$PANEL" >/dev/null 2>&1; then
    echo "  answering after ${attempt}s"
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "  $PANEL never answered. Not building the website against a panel" >&2
    echo "  that is down — it would build an empty site and call it a success." >&2
    pm2 logs lotuspeak-admin --lines 40 --nostream || true
    exit 1
  fi
  sleep 1
done

say "Building the website"
npm run build:web

say "Starting the website"
if pm2 describe lotuspeak-web >/dev/null 2>&1; then
  pm2 reload lotuspeak-web --update-env
else
  pm2 start deploy/ecosystem.config.js --only lotuspeak-web
fi

pm2 save

say "Up"
pm2 status
cat <<EOF

  Worth doing once, by hand, now:

    curl -s http://127.0.0.1:6010/ | head          content in the HTML, no JS
    curl -s $PANEL | jq            mail and mailWebhook both ok
    open the site and look at a photograph         the bucket is public
    publish something in the panel and reload      revalidation gets through
    send a real enquiry through the form           the one failure that costs

  The route table from the build above: every page route should be
  marked static or SSG. A route rendered on demand is a regression.

EOF
