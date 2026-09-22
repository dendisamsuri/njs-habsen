#!/usr/bin/env bash
# Run e2e tests on server in a throwaway node container (prod image has no dev deps).
set -euo pipefail
cd /opt/njs-habsen
set -a; . ./.env; set +a
docker run --rm \
  --network njs-habsen_default \
  -e DATABASE_URL="mysql://root:${MYSQL_ROOT_PASSWORD:-root}@mysql:3306/njs_habsen?timezone=Z" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}" \
  -e JWT_ACCESS_TTL="${JWT_ACCESS_TTL:-3600}" \
  -e JWT_REFRESH_TTL="${JWT_REFRESH_TTL:-604800}" \
  -v /opt/njs-habsen:/app -v /app/node_modules -w /app \
  node:22-bookworm-slim sh -c 'set -x; npm ci --no-audit --no-fund || exit 10; npx prisma generate || exit 11; npm run test:e2e; rc=$?; echo JEST_EXIT=$rc; exit $rc'
status=$?
echo "REMOTE_EXIT=$status"
exit $status
