#!/usr/bin/env bash
set -euo pipefail
cd /opt/njs-habsen
docker compose -f docker-compose.prod.yml --profile seed run --rm seed 2>&1 | tail -15
sleep 2
bash /tmp/smoke2.sh
