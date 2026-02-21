#!/bin/sh
set -e

# This script runs as root.
# It ensures the node user owns the directories that are mounted as volumes.
echo "Fixing permissions..."
chown -R node:node /usr/src/app/web/.next
chown -R node:node /usr/src/app/node_modules
chown -R node:node /usr/src/app/web/node_modules
echo "Permissions fixed."

# Step down from root to the node user and execute the main container command (CMD)
if [ "$RUN_MIGRATIONS_ONCE" = "true" ]; then
  echo "Running database migrations..."
  gosu node npx prisma migrate deploy
fi

if [ "$NODE_ENV" = "beta" ] && [ "$SKIP_DB_SYNC" != "true" ]; then
  echo "Detected $NODE_ENV environment. Syncing curated game data from GCS..."
  corepack enable && gosu node pnpm run db:sync || echo "Warning: db:sync failed, continuing startup..."
fi

exec gosu node "$@"
