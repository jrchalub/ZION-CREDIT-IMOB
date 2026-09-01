#!/bin/sh
set -e

if [ "${SKIP_WAIT:-false}" != "true" ]; then
  pnpm exec tsx src/scripts/wait-for-db.ts
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  pnpm db:migrate
  if [ "${SEED_CATALOG:-true}" = "true" ]; then
    pnpm db:catalog
  fi
fi

exec "$@"
