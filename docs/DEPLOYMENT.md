# Hướng dẫn Triển khai (Deployment Guide) - LMS_LumiBach

Tài liệu này hướng dẫn cách triển khai hệ thống LMS_LumiBach lên server (VPS) thực tế.

## 1. Yêu cầu Hệ thống (System Requirements)

Để hệ thống chạy ổn định, đặc biệt là khi có Judge0 (trình chấm code), cấu hình khuyến nghị như sau:

*   **OS**: Ubuntu 22.04 LTS hoặc 24.04 LTS.
*   **CPU**: Tối thiểu 2 Cores (Khuyến nghị 4 Cores nếu có nhiều học sinh chấm code đồng thời).
*   **RAM**: Tối thiểu 4GB (Khuyến nghị 8GB).
*   **Disk**: 20GB+ SSD.
*   **Domain**: Đã trỏ về IP của server.

---

## 2. Chuẩn bị Môi trường

Cài đặt các công cụ cần thiết trên Server:

### Cài đặt Docker & Docker Compose
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Thêm user vào group docker
sudo usermod -aG docker $USER
# Logout và Login lại để lệnh có hiệu lực
```

### Cài đặt Node.js & pnpm (Nếu build trực tiếp trên server)
```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20
npm install -g pnpm
```

---

## 3. Triển khai Cơ sở hạ tầng (Infrastructure)

Sử dụng Docker Compose để chạy các dịch vụ bổ trợ: PostgreSQL, Redis, MinIO, Judge0.

1.  Clone dự án về server:
    ```bash
    git clone https://github.com/your-username/lumibach.git
    cd lumibach
    ```

2.  Cấu hình `docker-compose.yml`:
    *   Đảm bảo các mật khẩu trong `docker-compose.yml` đã được thay đổi an toàn.
    *   Chạy các dịch vụ:
        ```bash
        docker compose up -d
        ```

---

## 4. Cấu hình Biến môi trường (Environment Variables)

Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

Chỉnh sửa các giá trị quan trọng:
*   `DATABASE_URL`: Trỏ đến container PostgreSQL (thường là `postgresql://lumibach:PASSWORD@localhost:5432/lumibach`).
*   `REDIS_URL`: `redis://localhost:6379`.
*   `NEXTAUTH_SECRET`: Tạo bằng lệnh `openssl rand -base64 32`.
*   `NEXTAUTH_URL`: URL chính thức của trang web (VD: `https://lms.yourdomain.com`).
*   `MINIO_*`: Cấu hình truy cập MinIO (S3 storage).
*   `SMTP_*`: Thông tin gửi mail (Gmail App Password hoặc dịch vụ như Resend/SendGrid).
*   `JUDGE0_API_URL`: Mặc định là `http://localhost:2358`.

---

## 5. Cài đặt và Build Ứng dụng

1.  Cài đặt dependencies:
    ```bash
    pnpm install
    ```

2.  Đẩy schema database:
    ```bash
    npx prisma migrate deploy
    npx prisma generate
    ```

3.  Build ứng dụng Next.js:
    ```bash
    pnpm build
    ```

---

## 6. Chạy Ứng dụng & Workers

Sử dụng `pm2` để quản lý quy trình chạy ngầm và tự khởi động lại:

```bash
npm install -g pm2

# Chạy Next.js App
pm2 start "pnpm start" --name lumibach-web

# Chạy Worker chấm code
pm2 start "npx tsx src/workers/code-execution.ts" --name lumibach-worker-code

# Chạy Worker gửi email
pm2 start "npx tsx src/workers/email.worker.ts" --name lumibach-worker-email

# Lưu cấu hình pm2
pm2 save
pm2 startup
```

---

## 7. Cấu hình Reverse Proxy (Nginx) & SSL

Cài đặt Nginx:
```bash
sudo apt install nginx -y
```

Tạo cấu hình site: `/etc/nginx/sites-available/lumibach`
```nginx
server {
    server_name lms.yourdomain.com;

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

Kích hoạt và cài đặt SSL:
```bash
sudo ln -s /etc/nginx/sites-available/lumibach /etc/nginx/sites-enabled/
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d lms.yourdomain.com
```

---

## 8. Bảo trì & Logs

*   Xem log web: `pm2 logs lumibach-web`
*   Xem log workers: `pm2 logs lumibach-worker-code`
*   Restart hệ thống: `pm2 restart all`
*   Cập nhật code mới:
    ```bash
    git pull
    pnpm install
    npx prisma migrate deploy
    pnpm build
    pm2 restart all
    ```
