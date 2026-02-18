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
echo "Running database migrations..."
gosu node npx prisma migrate deploy

if [ "$NODE_ENV" = "development" ]; then
  echo "Detected Beta environment. Syncing curated game data from GCS..."
  gosu node npm run db:sync
fi

exec gosu node "$@"
