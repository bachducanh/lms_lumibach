#!/usr/bin/env bash
# Kéo bản sao lưu TOÀN BỘ (PostgreSQL + 3 bucket MinIO) từ máy chủ về máy này —
# bản NGOÀI máy chủ, phòng khi mất cả máy. Nên chạy mỗi tuần và trước mỗi lần
# phát hành có migration.
#
#   bash scripts/backup-full.sh          # lưu vào E:/lumibach-backups/full-<thời điểm>
#
# Nó chạy scripts/server/backup.sh trên máy chủ (dump mới + cập nhật bản sao MinIO)
# rồi chép kết quả về. Định dạng thư mục khớp với scripts/restore-to-server.sh.
# Thư mục đích nằm NGOÀI repo có chủ đích — dump chứa dữ liệu cá nhân học sinh.
set -euo pipefail

SERVER="${SERVER:-root@222.255.182.231}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lumibach_ed25519}"
ROOT="${BACKUP_ROOT:-E:/lumibach-backups}"
OUT="$ROOT/full-$(date +%F-%H%M)"
SSH="ssh -i $SSH_KEY -o BatchMode=yes $SERVER"
mkdir -p "$OUT"

echo "==> Sao lưu trên máy chủ"
$SSH /opt/lumibach/scripts/server/backup.sh

echo "==> PostgreSQL -> $OUT/lumibach.dump"
$SSH 'cat "$(ls -1t /opt/lumibach/backups/db/lumibach-*.dump | head -1)"' > "$OUT/lumibach.dump"
TABLES=$(docker run --rm -i postgres:17-alpine pg_restore -l < "$OUT/lumibach.dump" | grep -c "TABLE DATA" || true)
echo "    $TABLES bảng có dữ liệu"
[ "$TABLES" -gt 40 ] || { echo "!! Dump có vẻ hỏng (ít hơn 40 bảng) — DỪNG" >&2; exit 1; }

echo "==> MinIO -> $OUT/minio"
$SSH 'tar -C /opt/lumibach/backups -cf - minio' | tar -C "$OUT" -xf -
for d in "$OUT"/minio/*/; do
  echo "    $(basename "$d"): $(find "$d" -type f | wc -l) file"
done

echo "==> Xong: $OUT"
du -sh "$OUT"
