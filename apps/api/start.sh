#!/bin/sh

echo "=== Running database schema push ==="
cd /app/packages/database
npx drizzle-kit push --force || echo "WARNING: Database schema push failed (non-fatal, continuing...)"
cd /app/apps/api
echo "=== Database schema push complete ==="

if [ -n "$ADMIN_EMAIL" ]; then
  echo "=== Creating admin user ==="
  npx tsx src/scripts/create-admin.ts || echo "WARNING: Admin setup failed (non-fatal, continuing...)"
  echo "=== Admin setup complete ==="
fi

echo "=== Starting API server ==="
exec node dist/index.js
