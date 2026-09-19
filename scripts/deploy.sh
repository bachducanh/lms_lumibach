#!/usr/bin/env bash
# Phát hành bản mới lên máy chủ — MỘT lệnh, chạy trên máy phát triển:
#
#   bash scripts/deploy.sh
#
# Làm theo đúng thứ tự trong docs/HANDOVER.md mục 3:
#   sao lưu về máy này → chép mã nguồn → build → migration → lên bản mới → kiểm tra.
# Build chạy trong khi bản cũ vẫn phục vụ; học sinh chỉ bị gián đoạn vài giây lúc
# container được tạo lại.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER="${SERVER:-root@222.255.182.231}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lumibach_ed25519}"
SSH="ssh -i $SSH_KEY -o BatchMode=yes $SERVER"

# Máy chủ phải chạy đúng một commit — nếu không, sau này không biết đang chạy bản nào.
if [ -n "$(git status --porcelain)" ]; then
  echo "!! Còn thay đổi chưa commit. Commit trước rồi chạy lại:" >&2
  git status --short >&2
  exit 1
fi
REV=$(git rev-parse --short HEAD)
echo "==> Phát hành $REV: $(git log -1 --format=%s)"

if [ "${SKIP_BACKUP:-}" != 1 ]; then
  echo "==> Sao lưu về máy này (migration chỉ đi một chiều)"
  bash scripts/backup-full.sh | tail -1
fi

echo "==> Chép mã nguồn"
# Xoá mã cũ trước để file đã bị xoá trong git cũng mất trên máy chủ.
# .env, judge0.conf, backups/, cloudflared/ nằm ngoài apps/ packages/ nên không bị đụng.
$SSH 'cd /opt/lumibach && rm -rf apps packages scripts'
git ls-files -z | tar --null -T - -czf - | $SSH 'tar -C /opt/lumibach -xzf -'
$SSH "echo $REV > /opt/lumibach/REVISION"

$SSH 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/lumibach
C="docker compose -f docker-compose.single.yml"

echo "==> Build (10-20 phút)"
$C --profile tools build migrate api worker web > /root/build.log 2>&1 \
  || { tail -30 /root/build.log; echo "!! Build hỏng — bản cũ vẫn đang chạy, chưa có gì thay đổi" >&2; exit 1; }

echo "==> Migration (TRƯỚC khi lên bản mới)"
# -T và </dev/null: script này đang được đọc qua stdin (bash -s). Không chặn thì
# `run` nuốt phần còn lại của script — migration xong là dừng, không lên bản mới.
$C --profile tools run --rm -T migrate </dev/null 2>&1 | tail -3

echo "==> Lên bản mới"
$C up -d --remove-orphans 2>&1 | grep -v "Running\|Waiting\|Healthy" || true
$C --profile tunnel up -d cloudflared 2>&1 | tail -1
bash scripts/server/install-cron.sh

docker builder prune -af > /dev/null
docker image prune -f > /dev/null

echo "==> Kiểm tra"
for i in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' lumibach-api)" = healthy ] && break; sleep 3
done
docker exec lumibach-api node -e "const u=process.env.JUDGE0_API_URL;fetch(u+'/submissions?base64_encoded=false&wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language_id:71,source_code:'print(2+3)'})}).then(r=>r.json()).then(d=>console.log('    chấm code:',(d.stdout||'').trim(),d.status.description)).catch(e=>console.log('    chấm code LỖI:',e.message))"
docker logs lumibach-worker 2>&1 | grep -q "email-worker\] started" && echo "    worker email: chạy" || echo "    !! worker email KHÔNG chạy"
echo "    giờ: $(docker exec lumibach-web date '+%H:%M %Z')"
echo "    ổ đĩa: $(df -h / | awk 'NR==2{print $5" đã dùng"}')"
REMOTE

echo "==> Kiểm qua tên miền"
sleep 5
for u in https://lumibach.com/login https://lumibach.com/api/v1/me "https://lumibach.com/socket.io/?EIO=4&transport=polling"; do
  printf '    %s  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$u")" "$u"
done
echo "    (mong đợi: 200, 401, 200)"
echo "==> Xong $REV. Thử thêm trên trình duyệt: đăng nhập, nộp bài, nộp code."
