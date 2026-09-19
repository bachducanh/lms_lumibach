#!/usr/bin/env bash
# Nạp một bản sao lưu của scripts/backup-full.sh lên máy chủ một-máy
# (docker-compose.single.yml). GHI ĐÈ toàn bộ DB và file trên máy chủ đích.
#
#   bash scripts/restore-to-server.sh E:/lumibach-backups/full-2026-09-19-1341
#
# Biến tuỳ chọn: SERVER (mặc định root@222.255.182.231), SSH_KEY, REMOTE_DIR.
set -euo pipefail

SRC="${1:?Cho đường dẫn thư mục sao lưu full-*}"
SERVER="${SERVER:-root@222.255.182.231}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lumibach_ed25519}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lumibach}"
SSH="ssh -i $SSH_KEY -o BatchMode=yes $SERVER"

[ -s "$SRC/lumibach.dump" ] || { echo "!! Không thấy $SRC/lumibach.dump" >&2; exit 1; }
[ -d "$SRC/minio" ] || { echo "!! Không thấy $SRC/minio" >&2; exit 1; }

echo "==> Chép bản sao lưu lên $SERVER:$REMOTE_DIR/restore"
$SSH "rm -rf $REMOTE_DIR/restore && mkdir -p $REMOTE_DIR/restore"
tar -C "$SRC" -cf - lumibach.dump minio | $SSH "tar -C $REMOTE_DIR/restore -xf -"

$SSH "REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
C="docker compose -f docker-compose.single.yml"
val() { grep -m1 "^$1=" .env | cut -d= -f2-; }

# Tắt những gì đang ghi vào DB/MinIO để bản nạp không bị chen ngang.
$C stop web api worker 2>/dev/null || true
$C up -d --wait postgres minio

echo "==> PostgreSQL"
# --clean --if-exists: nạp lại nhiều lần được (lần thử và lần chuyển thật).
# --no-owner: chủ sở hữu trên máy cũ có thể khác user `lumibach` ở đây.
docker exec -i lumibach-postgres pg_restore -U lumibach -d lumibach_lms \
  --clean --if-exists --no-owner --no-privileges < restore/lumibach.dump
docker exec lumibach-postgres psql -U lumibach -d lumibach_lms -tAc \
  "select count(*) || ' người dùng' from \"User\""

echo "==> MinIO"
docker run --rm --network lumibach_default -v "$PWD/restore/minio:/src:ro" \
  -e AK="$(val MINIO_ACCESS_KEY)" -e SK="$(val MINIO_SECRET_KEY)" \
  --entrypoint sh quay.io/minio/mc -c '
    set -e
    mc alias set dst http://minio:9000 "$AK" "$SK" >/dev/null
    for d in /src/*/; do
      b=$(basename "$d")
      mc mb --ignore-existing "dst/$b" >/dev/null
      mc mirror --quiet --overwrite --remove "$d" "dst/$b" >/dev/null
      echo "    $b: $(mc ls -r "dst/$b" | wc -l) file"
    done
    # Hai bucket phục vụ công khai; handovers giữ riêng tư. CHỈ s3:GetObject,
    # khớp publicReadPolicy() trong apps/web/src/lib/storage.ts. ĐỪNG dùng
    # `mc anonymous set download` — nó kèm ListBucket, ai cũng liệt kê được
    # toàn bộ tên file bài nộp của học sinh.
    for b in lumibach-avatars lumibach-files; do
      printf "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::%s/*\"]}]}" "$b" > /tmp/p.json
      mc anonymous set-json /tmp/p.json "dst/$b" >/dev/null
    done'

$C up -d
rm -rf restore
echo "==> Xong. Kiểm: $C ps"
REMOTE
