# Hướng dẫn Triển khai trên Server Vật lý (Bare Metal Deployment Guide)

Tài liệu này cung cấp các bước chi tiết để thiết lập và triển khai hệ thống LMS_LumiBach trên một máy chủ vật lý (Physical Server) chạy hệ điều hành Ubuntu Server.

## 1. Chuẩn bị Phần cứng & Hệ điều hành

### Yêu cầu Phần cứng (Khuyến nghị)

- **CPU:** Intel Xeon hoặc Core i7/i9 (Tối thiểu 4 Cores).
- **RAM:** 16GB trở lên (Để chạy mượt các Worker chấm code và Redis).
- **Disk:** SSD NVMe 250GB+ (Nên cấu hình RAID 1 để an toàn dữ liệu).
- **Network:** Kết nối Internet ổn định, có IP tĩnh (Static IP).

### Cài đặt Hệ điều hành

1. Tải bản **Ubuntu Server 22.04 LTS** hoặc **24.04 LTS**.
2. Cài đặt qua USB Boot.
3. Trong quá trình cài đặt:
   - Chọn ngôn ngữ: **English**.
   - Cấu hình **Static IP** (không nên dùng DHCP để tránh đổi IP nội bộ).
   - Cài đặt **OpenSSH Server** để điều khiển từ xa.

---

## 2. Bảo mật Hệ thống Cơ bản

Sau khi cài đặt OS, thực hiện các bước bảo mật:

### Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

### Cấu hình Firewall (UFW)

Chỉ mở các cổng cần thiết:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 9000/tcp # Nếu cần truy cập MinIO Console từ ngoài
sudo ufw enable
```

### Bảo mật SSH

Chỉnh sửa file `/etc/ssh/sshd_config`:

- Đổi cổng mặc định (VD: từ 22 sang 2222) - _Tùy chọn_.
- Tắt đăng nhập bằng mật khẩu, chỉ dùng **SSH Key**.
- Tắt đăng nhập bằng tài khoản `root`.

---

## 3. Cài đặt Môi trường (Docker & Runtime)

Dù là server vật lý, việc sử dụng Docker vẫn được khuyến nghị để cô lập các dịch vụ như Database và Judge0.

### Cài đặt Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Cài đặt Node.js (v20) & pnpm

```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20
npm install -g pnpm pm2
```

---

## 4. Triển khai Cơ sở hạ tầng (Cơ sở dữ liệu & Storage)

Sử dụng Docker Compose để chạy các dịch vụ lõi:

1. Clone mã nguồn:

   ```bash
   git clone https://github.com/bachducanh/lms_lumibach.git
   cd lms_lumibach
   ```

2. Khởi chạy các container:

   ```bash
   docker compose up -d
   ```

3. Kiểm tra trạng thái:
   ```bash
   docker compose ps
   ```

---

## 5. Triển khai Ứng dụng Next.js

1. **Cấu hình .env:**
   Copy file mẫu và chỉnh sửa thông tin thực tế:

   ```bash
   cp .env.example .env
   nano .env
   ```

   _Lưu ý:_ Cập nhật `DATABASE_URL` và `NEXTAUTH_URL`.

2. **Cài đặt & Build:**

   ```bash
   pnpm install
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Build ứng dụng Next.js & Scratch Editor:**

   ```bash
   pnpm build
   pnpm build:scratch-gui
   ```

4. **Quản lý bằng PM2:**
   Chạy ứng dụng và các worker chấm code:

   ```bash
   # App chính
   pm2 start "pnpm start" --name lumibach-web

   # Worker xử lý chấm bài Code (Quan trọng)
   pm2 start "npx tsx src/workers/code-execution.ts" --name lumibach-worker-code

   # Worker gửi Email
   pm2 start "npx tsx src/workers/email.worker.ts" --name lumibach-worker-email

   # Lưu cấu hình để tự khởi động cùng Server
   pm2 save
   pm2 startup
   ```

---

## 6. Cấu hình Nginx & SSL (HTTPS)

### Cài đặt Nginx

```bash
sudo apt install nginx -y
```

### Tạo cấu hình Site

Tạo file `/etc/nginx/sites-available/lumibach`:

```nginx
server {
    listen 80;
    server_name lms.yourdomain.com; # Thay bằng domain của bạn

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Kích hoạt SSL (Certbot)

```bash
sudo ln -s /etc/nginx/sites-available/lumibach /etc/nginx/sites-enabled/
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d lms.yourdomain.com
```

---

## 7. Chiến lược Sao lưu Dữ liệu (Backup Strategy)

Trên server vật lý, việc hỏng ổ cứng là rủi ro lớn nhất.

### Backup Docker Volumes

Tạo một script backup hàng ngày (`/home/user/backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backup/storage" # Nên là ổ cứng ngoài hoặc Cloud Storage
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Backup Database
docker exec lumibach-postgres pg_dump -U lumibach lumibach > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup MinIO Data (Các tệp tin)
tar -czf $BACKUP_DIR/files_$TIMESTAMP.tar.gz /var/lib/docker/volumes/lms_lumibach_minio_data/_data

# Xóa các bản backup cũ hơn 30 ngày
find $BACKUP_DIR -type f -mtime +30 -delete
```

Cấu hình **Crontab** để chạy hàng đêm lúc 2:00 AM:

```bash
0 2 * * * /home/user/backup.sh
```

---

## 8. Giám sát Server (Monitoring)

- **Xem Log ứng dụng:** `pm2 logs`
- **Kiểm tra tài nguyên:** `htop` hoặc `docker stats`
- **Nhiệt độ phần cứng:** `sensors` (Cài gói `lm-sensors`)

---

_Tài liệu được cập nhật ngày: 07/05/2026_
