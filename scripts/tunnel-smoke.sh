#!/usr/bin/env bash
set -euo pipefail
BASE=https://sistemlvn.web.id

echo "=== UI ==="
curl -s -o /dev/null -w "ui_login=%{http_code}\n" "$BASE/ui/login"

echo "=== login employee ==="
LOGIN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"employee@demo.test","password":"Password123!"}')
echo "$LOGIN" | head -c 280
echo
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token_len=${#TOKEN}"

echo "=== today ==="
curl -s "$BASE/api/v1/attendance/today" -H "Authorization: Bearer $TOKEN" | head -c 320
echo

echo "=== bad login en ==="
curl -s -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' -H 'Accept-Language: en' \
  -d '{"email":"bad@x.test","password":"x"}'
echo

echo "=== root/head ==="
curl -sI "$BASE/" -o /dev/null -w "get_root=%{http_code}\n" || true
curl -sI -X HEAD "$BASE/" -o /dev/null -w "head_root=%{http_code}\n" || true

echo "=== locations check ==="
curl -s -X POST "$BASE/api/v1/locations/check" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":-6.2,"longitude":106.8166667}' | head -c 300
echo
echo "ALL_DONE"
