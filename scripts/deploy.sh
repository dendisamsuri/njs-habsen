#!/usr/bin/env bash
# Deploy njs-habsen over SSH (host: ubuntu) using tar (no rsync required)
set -euo pipefail
HOST="${HOST:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/opt/njs-habsen}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="${TMPDIR:-/tmp}/njs-habsen-deploy.tar.gz"

echo "==> pack"
tar -czf "$TAR" \
  --exclude node_modules --exclude dist --exclude .git --exclude .kilo \
  --exclude .env --exclude coverage --exclude '*.log' --exclude 'uploads' \
  -C "$ROOT" .

echo "==> upload"
scp -q "$TAR" "$HOST:/tmp/njs-habsen-deploy.tar.gz"

echo "==> extract + build + up"
ssh "$HOST" "set -e
mkdir -p '$REMOTE_DIR'
tar -xzf /tmp/njs-habsen-deploy.tar.gz -C '$REMOTE_DIR'
cd '$REMOTE_DIR'
test -f .env || cp .env.example .env
docker compose -f docker-compose.prod.yml build app face
docker compose -f docker-compose.prod.yml up -d mysql face
for i in \$(seq 1 40); do
  st=\$(docker inspect -f '{{.State.Health.Status}}' njs_habsen_mysql 2>/dev/null || echo none)
  [ \"\$st\" = healthy ] && break
  sleep 3
done
docker compose -f docker-compose.prod.yml up -d app
sleep 6
docker compose -f docker-compose.prod.yml --profile seed run --rm seed || true
"

echo "==> smoke"
ssh "$HOST" "curl -sI http://127.0.0.1:3000/ui/login | head -3"
ssh "$HOST" "curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"employee@demo.test\",\"password\":\"Password123!\"}' | head -c 220; echo"
ssh "$HOST" "docker exec njs_habsen_face curl -fsS http://127.0.0.1:8000/health; echo"
echo "==> done $HOST:$REMOTE_DIR"
