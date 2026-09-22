#!/usr/bin/env bash
set -euo pipefail
cd /opt/njs-habsen
MYPASS=$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)
docker exec njs_habsen_mysql sh -lc "exec /usr/bin/mysql -uroot -p$MYPASS -e 'SHOW CREATE TABLE njs_habsen.login_attempts'"
echo '--- migrations ---'
docker exec njs_habsen_mysql sh -lc "exec /usr/bin/mysql -uroot -p$MYPASS -e 'SELECT migration_name, finished_at FROM njs_habsen._prisma_migrations'"
echo '--- drop + recreate ---'
docker exec njs_habsen_mysql sh -lc "exec /usr/bin/mysql -uroot -p$MYPASS -e 'DROP DATABASE IF EXISTS njs_habsen; CREATE DATABASE njs_habsen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
echo '--- recreate app ---'
cd /opt/njs-habsen
docker compose -f docker-compose.prod.yml up -d --force-recreate app
sleep 8
echo '--- show create after migrate ---'
docker exec njs_habsen_mysql sh -lc "exec /usr/bin/mysql -uroot -p$MYPASS -e 'SHOW CREATE TABLE njs_habsen.login_attempts'"
echo '--- seed ---'
docker compose -f docker-compose.prod.yml --profile seed run --rm seed 2>&1 | tail -6
echo '--- smoke ---'
bash /tmp/smoke2.sh
