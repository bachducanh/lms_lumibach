# Hướng dẫn Triển khai (Deployment Guide) — LMS_LumiBach

Tài liệu này hướng dẫn triển khai hệ thống lên server thực tế.

- Triển khai trên **máy chủ vật lý** (mua máy, cài Ubuntu): xem thêm [PHYSICAL_SERVER_SETUP.md](PHYSICAL_SERVER_SETUP.md).
- Đưa hệ thống lên **tên miền lumibach.com** qua Cloudflare Tunnel: xem [DOMAIN_SETUP.md](DOMAIN_SETUP.md).

---

## 1. Kiến trúc cần triển khai

Dự án là **monorepo pnpm + Turborepo**, khi chạy production gồm **4 tiến trình Node**
và **4 dịch vụ hạ tầng trong Docker**:

| Thành phần              | Nguồn                                    | Cổng        | Vai trò                                                         |
| ----------------------- | ---------------------------------------- | ----------- | --------------------------------------------------------------- |
| `lumibach-web`          | `apps/web` (Next.js 16)                  | 3000        | Giao diện + rewrite `/api/v1/*` và `/storage/*`                 |
| `lumibach-api`          | `apps/api` (NestJS 11)                   | 4000        | REST API `/api/v1`, WebSocket `/socket.io`, Swagger `/api/docs` |
| `lumibach-worker-code`  | `apps/web/src/workers/code-execution.ts` | —           | Hàng đợi BullMQ chấm bài code qua Judge0                        |
| `lumibach-worker-email` | `apps/web/src/workers/email.worker.ts`   | —           | Hàng đợi gửi email                                              |
| PostgreSQL 16           | Docker                                   | 5432        | Cơ sở dữ liệu (Prisma ở `packages/db`)                          |
| Redis 7                 | Docker                                   | 6379        | Hàng đợi BullMQ + cache                                         |
| MinIO                   | Docker                                   | 9000 / 9001 | Lưu ảnh, tệp bài tập                                            |
| Judge0 CE               | Docker                                   | 2358        | Sandbox chạy code học sinh                                      |

Trình duyệt **chỉ cần truy cập cổng 3000** (qua reverse proxy / tunnel). API, MinIO,
Judge0 đều đi qua nội bộ — không expose ra Internet.

---

## 2. Yêu cầu Hệ thống

- **OS**: Ubuntu 22.04 LTS hoặc 24.04 LTS.
- **CPU**: tối thiểu 2 cores; khuyến nghị 4 cores nếu nhiều học sinh chấm code đồng thời.
- **RAM**: tối thiểu 4GB; khuyến nghị 8GB (Judge0 + 4 tiến trình Node khá tốn).
- **Disk**: 20GB+ SSD.
- **Node.js**: >= 20 (bắt buộc, xem `engines` trong `package.json`).
- **pnpm**: 9.x (`packageManager: pnpm@9.1.0`).

---

## 3. Chuẩn bị Môi trường

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout / login lại để nhóm docker có hiệu lực

# Node.js 20 + pnpm + pm2
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20 && fnm use 20
npm install -g pnpm@9 pm2
```

---

## 4. Triển khai hạ tầng (Docker)

```bash
git clone https://github.com/bachducanh/lms_lumibach.git /opt/lumibach
cd /opt/lumibach
```

> **Trước khi chạy**: sửa `docker-compose.yml` — đổi `POSTGRES_PASSWORD`,
> `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` khỏi giá trị mặc định trong repo.
> Trong `judge0.conf`, đổi mật khẩu Postgres/Redis của Judge0 cho khớp.

```bash
docker compose up -d
docker compose ps        # tất cả phải ở trạng thái healthy
```

---

## 5. Biến môi trường

```bash
cp .env.example .env
nano .env
```

Các giá trị bắt buộc đổi khi lên production:

| Biến                                              | Ghi chú                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | Khớp mật khẩu vừa đặt trong `docker-compose.yml`                                                  |
| `AUTH_SECRET`                                     | Sinh mới bằng `openssl rand -base64 32`                                                           |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`             | URL public thật, ví dụ `https://lumibach.com` — **không để localhost**                            |
| `AUTH_TRUST_HOST`                                 | `true` khi chạy sau reverse proxy / tunnel                                                        |
| `NEXT_PUBLIC_API_URL`                             | `/api/v1` (tương đối) để trình duyệt đi qua rewrite của Next.js                                   |
| `API_INTERNAL_URL`                                | `http://localhost:4000/api/v1` — **phải tuyệt đối**, Server Component và cron route dùng biến này |
| `NEXT_PUBLIC_WS_URL`                              | Để trống nếu WebSocket đi chung hostname (xem [DOMAIN_SETUP.md](DOMAIN_SETUP.md))                 |
| `MINIO_INTERNAL_ENDPOINT` / `MINIO_INTERNAL_PORT` | Địa chỉ MinIO nhìn từ tiến trình Node                                                             |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`           | Khớp `docker-compose.yml`                                                                         |
| `SMTP_*`                                          | Dịch vụ gửi mail giao dịch (Resend/Brevo) — xem [DOMAIN_SETUP.md](DOMAIN_SETUP.md) mục 4          |
| `JUDGE0_API_URL`                                  | `http://localhost:2358`                                                                           |
| `CRON_SECRET`                                     | Bắt buộc, nếu trống thì `/api/cron/*` luôn trả 401                                                |

> ⚠️ Biến `NEXT_PUBLIC_*` được **nhúng lúc build**. Đổi giá trị xong phải chạy lại
> `pnpm build`, chỉ `pm2 restart` là chưa đủ.

---

## 6. Cài đặt, migrate và build

```bash
pnpm install                 # postinstall tự chạy prisma generate + build packages/db, packages/types
pnpm db:migrate:deploy       # áp dụng migration cho DB production
pnpm build                   # turbo build cả apps/web (.next) và apps/api (dist)
```

Nếu dùng trình soạn Scratch:

```bash
pnpm --filter @lumibach/web build:scratch-gui
```

Tạo tài khoản quản trị đầu tiên (chỉ chạy lần đầu, seed dữ liệu mẫu):

```bash
pnpm db:seed
```

---

## 7. Chạy ứng dụng bằng PM2

Tạo `ecosystem.config.js` ở gốc dự án:

```js
module.exports = {
  apps: [
    {
      name: 'lumibach-web',
      cwd: '/opt/lumibach/apps/web',
      script: 'pnpm',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'lumibach-api',
      cwd: '/opt/lumibach/apps/api',
      script: 'node',
      args: 'dist/main.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'lumibach-worker-code',
      cwd: '/opt/lumibach/apps/web',
      script: 'pnpm',
      args: 'exec dotenv -e ../../.env -- tsx src/workers/code-execution.ts',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'lumibach-worker-email',
      cwd: '/opt/lumibach/apps/web',
      script: 'pnpm',
      args: 'exec dotenv -e ../../.env -- tsx src/workers/email.worker.ts',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # chạy tiếp lệnh mà pm2 in ra để tự khởi động cùng server
```

Ghi chú:

- `apps/api/src/main.ts` tự nạp `.env` ở gốc repo, `apps/web/next.config.ts` cũng vậy —
  nên không cần khai báo lại từng biến trong `ecosystem.config.js`.
- Hai worker chạy qua `tsx` (không build ra `dist`); `tsx` đã có sẵn trong
  devDependencies của `apps/web`, nên **đừng cài `pnpm install --prod`**.

Kiểm tra nhanh:

```bash
pm2 ls
curl -s localhost:4000/api/v1/health || curl -sI localhost:4000/api/docs
curl -sI localhost:3000
```

---

## 8. Đưa ra Internet

Chọn **một** trong hai cách:

### 8.1 Cloudflare Tunnel (khuyến nghị — máy chủ trong LAN, không có IP public)

Không cần mở port, không cần Certbot. Xem chi tiết: [DOMAIN_SETUP.md](DOMAIN_SETUP.md).

### 8.2 Nginx + Let's Encrypt (server có IP public)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

`/etc/nginx/sites-available/lumibach`:

```nginx
server {
    listen 80;
    server_name lumibach.com www.lumibach.com;

    client_max_body_size 100M;   # tệp bài nộp / video bài giảng

    # WebSocket (socket.io) phải vào thẳng NestJS — rewrite của Next.js không proxy được WS
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lumibach /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lumibach.com -d www.lumibach.com
```

---

## 9. Cron dọn thùng rác

`/api/cron/purge-trash` xoá hẳn khoá học đã ở thùng rác quá 30 ngày (kèm file MinIO).
Route yêu cầu header `x-cron-secret` khớp `CRON_SECRET`:

```cron
0 3 * * * curl -s -H "x-cron-secret: <CRON_SECRET>" http://localhost:3000/api/cron/purge-trash >> /var/log/lumibach-cron.log 2>&1
```

Tương tự với `/api/cron/due-soon` (nhắc hạn nộp bài) nếu muốn bật.

---

## 10. Cập nhật phiên bản mới

```bash
cd /opt/lumibach
git pull
pnpm install
pnpm db:migrate:deploy
pnpm build
pm2 restart all
```

Nếu migration có thay đổi lớn, backup DB trước:
`docker exec lumibach-postgres pg_dump -U lumibach lumibach > backup.sql`.

---

## 11. Vận hành & Log

| Việc                                   | Lệnh                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| Log từng tiến trình                    | `pm2 logs lumibach-api` / `lumibach-web` / `lumibach-worker-code` |
| Log email dev (khi chưa cấu hình SMTP) | `apps/api/logs/dev-emails.log`                                    |
| Tài nguyên                             | `pm2 monit`, `docker stats`, `htop`                               |
| Trạng thái hạ tầng                     | `docker compose ps`                                               |
| Khởi động lại toàn bộ                  | `pm2 restart all`                                                 |

**Bảo mật cần nhớ**: không mở ra Internet các cổng 5432 (Postgres), 6379 (Redis),
9000/9001 (MinIO), 2358 (Judge0). Judge0 chạy `privileged: true` nên tuyệt đối
không để lộ ra ngoài.

---

_Cập nhật: 03/08/2026_
