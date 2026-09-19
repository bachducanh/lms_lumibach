#!/usr/bin/env bash
# Cài lịch trong scripts/server/crontab vào crontab của root, điền CRON_SECRET từ .env.
# Ghi ĐÈ crontab root hiện có — mọi lịch của LumiBach phải nằm trong file crontab kia.
set -euo pipefail
cd /opt/lumibach
S=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2-)
[ -n "$S" ] || { echo "!! .env thiếu CRON_SECRET" >&2; exit 1; }
chmod +x scripts/server/*.sh
sed "s|__CRON_SECRET__|$S|g" scripts/server/crontab | crontab -
chmod 600 /var/spool/cron/crontabs/root 2>/dev/null || true
echo "Đã cài $(crontab -l | grep -cv '^\s*\(#\|$\|[A-Z]*=\)') lịch."
