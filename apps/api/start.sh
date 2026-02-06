#!/bin/sh
set -e

echo "=== Running database schema push ==="
cd /app/packages/database
npx drizzle-kit push --force
cd /app/apps/api
echo "=== Database schema push complete ==="

if [ -n "$ADMIN_EMAIL" ]; then
  echo "=== Creating admin user ==="
  npx tsx src/scripts/create-admin.ts
  echo "=== Admin setup complete ==="
fi

echo "=== Starting API server ==="
exec node dist/index.js
