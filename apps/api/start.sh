#!/bin/sh

# Run database setup in background so the API starts immediately
# and the healthcheck passes while db-push runs concurrently
(
  echo "=== Running database schema push ==="
  cd /app/packages/database
  timeout 60 npx drizzle-kit push --force 2>&1 || echo "WARNING: Database schema push failed or timed out"
  echo "=== Database schema push complete ==="

  if [ -n "$ADMIN_EMAIL" ]; then
    echo "=== Creating admin user ==="
    cd /app/apps/api
    timeout 30 npx tsx src/scripts/create-admin.ts 2>&1 || echo "WARNING: Admin setup failed or timed out"
    echo "=== Admin setup complete ==="
  fi
) &

echo "=== Starting API server ==="
exec node dist/index.js
