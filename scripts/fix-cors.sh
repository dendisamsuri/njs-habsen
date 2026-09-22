#!/usr/bin/env bash
set -euo pipefail
cd /opt/njs-habsen
grep -n CORS .env || true
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/njs-habsen/.env')
text = p.read_text()
line = 'CORS_ORIGINS=https://sistemlvn.web.id,https://www.sistemlvn.web.id'
import re
if re.search(r'^CORS_ORIGINS=.*$', text, re.M):
    text = re.sub(r'^CORS_ORIGINS=.*$', line, text, flags=re.M)
else:
    text = text.rstrip() + '\n' + line + '\n'
p.write_text(text)
print('updated')
PY
grep CORS .env
docker compose -f docker-compose.prod.yml up -d --force-recreate app
sleep 6
sudo systemctl is-active cloudflared
bash /tmp/tunnel-smoke.sh
