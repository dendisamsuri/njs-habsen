#!/usr/bin/env bash
set -euo pipefail
echo "=== containers ==="
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
echo "=== mysql image ==="
docker inspect njs_habsen_mysql --format '{{.Config.Image}} entry={{.Config.Entrypoint}}'
echo "=== find mysql client ==="
docker exec njs_habsen_mysql bash -lc 'command -v mysql; command -v mysqladmin; ls -la /usr/bin/mysql 2>&1 | head'
echo "=== env ==="
docker exec njs_habsen_mysql bash -lc 'echo MYSQL_ROOT_PASSWORD_set=${MYSQL_ROOT_PASSWORD:+yes}'
