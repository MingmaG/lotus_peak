#!/usr/bin/env bash
# Bring the development stack up and wait until Postgres actually answers.
#
# `docker compose up -d` returns as soon as the containers are created, which
# is several seconds before Postgres accepts a connection. Every `npm run dev`
# that raced it produced a Prisma error that looked like a misconfiguration and
# was not, so the wait lives here rather than in each caller.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

docker compose -f docker/docker-compose.yml up -d

printf 'waiting for postgres'
for _ in $(seq 1 60); do
  if docker compose -f docker/docker-compose.yml exec -T postgres \
      pg_isready -U lotuspeak -d lotuspeak >/dev/null 2>&1; then
    printf ' ready\n'
    exit 0
  fi
  printf '.'
  sleep 1
done

printf '\n'
echo "Postgres did not become ready within 60s." >&2
echo "Check: docker compose -f docker/docker-compose.yml logs postgres" >&2
exit 1
