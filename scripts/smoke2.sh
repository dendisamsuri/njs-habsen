#!/usr/bin/env bash
set -euo pipefail
LOGIN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"employee@demo.test","password":"Password123!"}')
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token_len=${#TOKEN}"
echo "=== today ==="
curl -s http://127.0.0.1:3000/api/v1/attendance/today -H "Authorization: Bearer $TOKEN"
echo
echo "=== bad login ==="
curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'Accept-Language: en' \
  -d '{"email":"nobody@x.test","password":"wrong"}'
echo
echo "=== recent logs ==="
docker logs --tail 50 njs_habsen_app 2>&1 | tail -50
