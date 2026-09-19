#!/usr/bin/env bash
# Sao lưu hằng ngày NGAY TRÊN máy chủ (chạy bằng cron, xem scripts/server/crontab).
#   /opt/lumibach/backups/db/lumibach-<ngày>.dump   giữ 14 bản gần nhất
#   /opt/lumibach/backups/minio/<bucket>/          bản sao cộng dồn, không xoá theo nguồn
#
# Bản này nằm CÙNG máy với dữ liệu — chỉ cứu được lỗi thao tác (xoá nhầm, migration
# hỏng), không cứu được khi mất cả máy. Bản ngoài máy: chạy scripts/backup-full.sh
# trên máy phát triển, nó kéo thư mục này về.
set -euo pipefail
cd /opt/lumibach
B=backups
mkdir -p "$B/db" "$B/minio"
val() { grep -m1 "^$1=" .env | cut -d= -f2-; }

f="$B/db/lumibach-$(date +%F-%H%M).dump"
docker exec lumibach-postgres pg_dump -U lumibach -Fc lumibach_lms > "$f.tmp"
n=$(docker exec -i lumibach-postgres pg_restore -l < "$f.tmp" | grep -c "TABLE DATA" || true)
if [ "$n" -lt 40 ]; then
  echo "$(date '+%F %T') LỖI: dump chỉ có $n bảng, giữ nguyên các bản cũ" >&2
  rm -f "$f.tmp"; exit 1
fi
mv "$f.tmp" "$f"
ls -1t "$B"/db/lumibach-*.dump | tail -n +15 | xargs -r rm -f

docker run --rm --network lumibach_default -v "$PWD/$B/minio:/data" \
  -e AK="$(val MINIO_ACCESS_KEY)" -e SK="$(val MINIO_SECRET_KEY)" \
  --entrypoint sh quay.io/minio/mc -c '
    mc alias set s http://minio:9000 "$AK" "$SK" >/dev/null
    for b in lumibach-avatars lumibach-files lumibach-handovers; do
      mc mirror --quiet --preserve "s/$b" "/data/$b" >/dev/null
    done'

echo "$(date '+%F %T') OK: $f ($n bảng, $(du -sh "$f" | cut -f1)); minio $(du -sh "$B/minio" | cut -f1)"
