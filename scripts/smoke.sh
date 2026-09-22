#!/usr/bin/env bash
set -euo pipefail
cd /opt/njs-habsen

echo "=== seed ==="
docker compose -f docker-compose.prod.yml --profile seed run --rm seed 2>&1 | tail -20 || true

echo "=== HEAD / ==="
curl -sI http://127.0.0.1:3000/ | head -5 || true

echo "=== login bad ==="
curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'Accept-Language: en' \
  -d '{"email":"nobody@x.test","password":"wrong"}' || true
echo

echo "=== seed login employee ==="
LOGIN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"employee@demo.test","password":"Password123!"}')
echo "$LOGIN" | head -c 400
echo
TOKEN=$(echo "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "=== today ==="
curl -s http://127.0.0.1:3000/api/v1/attendance/today -H "Authorization: Bearer $TOKEN" | head -c 400
echo

echo "=== locations check ==="
curl -s -X POST http://127.0.0.1:3000/api/v1/locations/check \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"latitude":-6.2,"longitude":106.8166667}' | head -c 400
echo

echo "=== UI login page ==="
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/ui/login

echo "=== admin login ==="
ALOGIN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.test","password":"Password123!"}')
ATOKEN=$(echo "$ALOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s http://127.0.0.1:3000/api/v1/admin/users -H "Authorization: Bearer $ATOKEN" | head -c 300
echo
