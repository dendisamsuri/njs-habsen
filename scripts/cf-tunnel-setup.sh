#!/usr/bin/env bash
set -euo pipefail

TUNNEL_NAME=njs-habsen
HOSTNAME=sistemlvn.web.id
TUNNEL_ID=$(cloudflared tunnel list | awk -v n="$TUNNEL_NAME" '$2==n {print $1}')
echo "TUNNEL_ID=$TUNNEL_ID"

# overwrite existing A/AAAA pointing elsewhere → CNAME tunnel
cloudflared tunnel route dns -f "$TUNNEL_NAME" "$HOSTNAME"

# system-wide config for service install
sudo mkdir -p /etc/cloudflared
sudo cp "/home/ubuntu/.cloudflared/${TUNNEL_ID}.json" /etc/cloudflared/
sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${HOSTNAME}
    service: http://127.0.0.1:3000
  - service: http_status:404
EOF
sudo chmod 600 /etc/cloudflared/*.json

cloudflared tunnel ingress validate

# install + enable service
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sleep 4
sudo systemctl is-active cloudflared
sudo journalctl -u cloudflared -n 40 --no-pager
