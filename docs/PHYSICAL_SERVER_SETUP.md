# Hướng dẫn Triển khai trên Server Vật lý (Bare Metal)

Tài liệu này tập trung vào phần **riêng của máy chủ vật lý**: phần cứng, cài OS,
bảo mật, mạng nội bộ và sao lưu.

Các bước chung (Docker, `.env`, build, PM2, cron, cập nhật) nằm ở
[DEPLOYMENT.md](DEPLOYMENT.md); phần tên miền và HTTPS nằm ở [DOMAIN_SETUP.md](DOMAIN_SETUP.md).

---

## 1. Chuẩn bị Phần cứng

Hệ thống chạy **4 tiến trình Node** (web, api, 2 worker) cùng **Postgres, Redis,
MinIO, Judge0** trong Docker, nên cần rộng tay về RAM:

- **CPU:** tối thiểu 4 cores (Judge0 chấm code song song rất tốn CPU).
- **RAM:** 16GB trở lên.
- **Disk:** SSD NVMe 250GB+; nên RAID 1 vì MinIO lưu toàn bộ tệp bài nộp và bài giảng.
- **Mạng:** kết nối ổn định. **Không bắt buộc IP tĩnh public** nếu dùng Cloudflare Tunnel —
  chỉ cần IP tĩnh trong LAN để các dịch vụ trỏ tới nhau ổn định.

---

## 2. Cài đặt Hệ điều hành

1. Tải **Ubuntu Server 24.04 LTS** (hoặc 22.04 LTS), cài qua USB boot.
2. Trong lúc cài:
   - Ngôn ngữ: **English**.
   - Cấu hình **Static IP** trong LAN (ví dụ `192.168.53.105`) — nếu dùng DHCP, IP đổi
     là `MINIO_INTERNAL_ENDPOINT` và `DATABASE_URL` trỏ sai ngay.
   - Bật **OpenSSH Server**.
3. Cài xong, ghi lại IP nội bộ — sẽ dùng lại trong `.env`.

---

## 3. Bảo mật cơ bản

```bash
sudo apt update && sudo apt upgrade -y
```

### Firewall (UFW)

Chỉ mở SSH. Với Cloudflare Tunnel thì **không cần mở cả 80/443**, vì cloudflared
tự mở kết nối đi ra:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
```

Nếu dùng Nginx + IP public thay cho tunnel thì mở thêm:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

> ⚠️ **Không bao giờ** mở ra Internet các cổng 5432 (Postgres), 6379 (Redis),
> 9000/9001 (MinIO), 2358 (Judge0). Judge0 chạy `privileged: true` — lộ ra ngoài
> đồng nghĩa với trao quyền chạy code tuỳ ý trên server. Cần xem MinIO Console từ xa
> thì dùng SSH tunnel: `ssh -L 9001:localhost:9001 user@server`.

### SSH

Trong `/etc/ssh/sshd_config`:

- `PasswordAuthentication no` — chỉ dùng SSH key.
- `PermitRootLogin no`.
- Đổi cổng mặc định 22 (tuỳ chọn), nhớ `sudo ufw allow <port>/tcp` trước khi restart.

```bash
sudo systemctl restart ssh
```

---

## 4. Cài môi trường và triển khai ứng dụng

Làm theo [DEPLOYMENT.md](DEPLOYMENT.md) mục 3 → 7:

1. Cài Docker, Node 20, pnpm 9, pm2.
2. `git clone` vào `/opt/lumibach`, sửa mật khẩu trong `docker-compose.yml`, `docker compose up -d`.
3. Tạo `.env` — với server vật lý, chú ý các biến trỏ vào IP LAN:

   ```dotenv
   MINIO_INTERNAL_ENDPOINT="192.168.53.105"
   MINIO_INTERNAL_PORT=9000
   API_INTERNAL_URL="http://localhost:4000/api/v1"
   ```

4. `pnpm install && pnpm db:migrate:deploy && pnpm build`.
5. Chạy 4 tiến trình bằng PM2 (`ecosystem.config.js` ở [DEPLOYMENT.md](DEPLOYMENT.md) mục 7),
   rồi `pm2 save && pm2 startup` để tự lên sau khi mất điện.

---

## 5. Đưa ra Internet

Máy chủ đặt trong LAN trường học thường **không có IP public** và bị chặn NAT —
dùng **Cloudflare Tunnel** cho `lumibach.com`: xem [DOMAIN_SETUP.md](DOMAIN_SETUP.md).

Nếu có IP tĩnh public và được phép NAT 80/443 thì dùng Nginx + Certbot theo
[DEPLOYMENT.md](DEPLOYMENT.md) mục 8.2.

---

## 6. Chống mất điện & tự phục hồi

Rủi ro lớn nhất của server vật lý là mất điện đột ngột (hỏng dữ liệu Postgres):

- Lắp **UPS**, cấu hình `nut` hoặc `apcupsd` để shutdown mềm khi pin gần cạn.
- Bật tự khởi động lại sau khi có điện: trong BIOS chọn _Restore on AC Power Loss → Power On_.
- Docker đã có `restart: unless-stopped`; PM2 tự lên nhờ `pm2 startup`.

Kiểm tra thử: rút điện đột ngột, cắm lại, sau ~3 phút `https://lumibach.com`
phải tự truy cập được mà không cần đăng nhập SSH.

---

## 7. Sao lưu dữ liệu

Ba thứ phải backup: **DB Postgres**, **tệp trong MinIO**, và **file `.env`**
(chứa `AUTH_SECRET` — mất là toàn bộ phiên đăng nhập và token hết hiệu lực).

Tạo `/opt/lumibach/scripts/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail
BACKUP_DIR="/mnt/backup"        # ổ cứng ngoài hoặc mount cloud storage
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database
docker exec lumibach-postgres pg_dump -U lumibach lumibach \
  | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Tệp trong MinIO
tar -czf "$BACKUP_DIR/files_$TIMESTAMP.tar.gz" \
  /var/lib/docker/volumes/lms_lumibach_minio_data/_data

# Cấu hình
cp /opt/lumibach/.env "$BACKUP_DIR/env_$TIMESTAMP.bak"

# Dọn bản cũ hơn 30 ngày
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
chmod +x /opt/lumibach/scripts/backup.sh
crontab -e
```

```cron
0 2 * * * /opt/lumibach/scripts/backup.sh >> /var/log/lumibach-backup.log 2>&1
```

**Kiểm tra phục hồi định kỳ** (backup chưa từng restore thử là backup chưa chắc dùng được):

```bash
gunzip -c /mnt/backup/db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i lumibach-postgres psql -U lumibach -d lumibach_restore_test
```

---

## 8. Giám sát

| Việc              | Lệnh                                                  |
| ----------------- | ----------------------------------------------------- |
| Tiến trình Node   | `pm2 monit`, `pm2 logs`                               |
| Container         | `docker compose ps`, `docker stats`                   |
| Tài nguyên máy    | `htop`, `df -h` (theo dõi dung lượng MinIO)           |
| Nhiệt độ / quạt   | `sensors` (cài `lm-sensors`)                          |
| Sức khoẻ ổ cứng   | `sudo smartctl -a /dev/nvme0n1` (cài `smartmontools`) |
| Trạng thái tunnel | `sudo systemctl status cloudflared`                   |

Nên bật cảnh báo dung lượng: khi `df -h` vượt 80%, MinIO và Postgres đều có nguy cơ
ghi lỗi giữa chừng.

---

_Cập nhật: 03/08/2026_
