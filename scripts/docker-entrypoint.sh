#!/bin/sh
set -eu

if [ "${MIGRATE_ON_BOOT:-true}" = "true" ]; then
  echo "Applying database migrations..."
  node scripts/migrate-prod.mjs
fi

if [ "$#" -eq 0 ]; then
  set -- node apps/mcp-server/dist/index.js
fi

echo "Starting Cybergogne MCP server..."
exec "$@"
