#!/usr/bin/env bash
# Print the secrets apps/admin/.env and apps/web/.env need.
#
# Two of the four are shared, and both are shared in the quiet way: a mismatch
# raises nothing at all. A wrong revalidation secret means publishing stops
# reaching the website until the hourly refresh picks it up, and a wrong
# preview secret means every preview link is refused. Neither says so, which is
# why they are printed together and labelled on both sides.
set -euo pipefail

gen() { openssl rand -base64 32 | tr -d '\n'; }

cat <<OUT
apps/admin/.env only
  AUTH_SECRET=$(gen)
  AUTH_REFRESH_SECRET=$(gen)

both files — the same value in each

  SITE_REVALIDATE_SECRET  (apps/admin/.env)
  REVALIDATE_SECRET       (apps/web/.env)
  = $(gen)

  PREVIEW_SECRET          (both files, same name)
  = $(gen)
OUT
