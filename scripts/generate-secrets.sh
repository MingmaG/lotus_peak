#!/usr/bin/env bash
# Print the secrets apps/admin/.env and apps/web/.env need.
#
# The revalidation secret is printed once and belongs in BOTH files —
# SITE_REVALIDATE_SECRET in the admin's, REVALIDATE_SECRET in the website's.
# They are the two ends of one HMAC; different values mean publishing silently
# stops reaching the site until the hourly refresh.
set -euo pipefail

gen() { openssl rand -base64 32 | tr -d '\n'; }

cat <<OUT
apps/admin/.env
  AUTH_SECRET=$(gen)
  AUTH_REFRESH_SECRET=$(gen)
  PREVIEW_SECRET=$(gen)

both files — the same value in each
  SITE_REVALIDATE_SECRET  (admin)
  REVALIDATE_SECRET       (web)
  = $(gen)
OUT
