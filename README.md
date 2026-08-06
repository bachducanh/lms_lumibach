# LumiBach LMS

Hệ thống quản lý học tập (LMS) cho môn Tin học, xây dựng dưới dạng monorepo:
Next.js (giao diện) + NestJS (API) + Prisma/PostgreSQL, kèm Redis, MinIO và Judge0.

## 🚀 Tài liệu hướng dẫn

- **Cài đặt môi trường Development**: [docs/SETUP.md](docs/SETUP.md)
- **Triển khai lên server**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Server vật lý (bare metal)**: [docs/PHYSICAL_SERVER_SETUP.md](docs/PHYSICAL_SERVER_SETUP.md)
- **Tên miền lumibach.com + Cloudflare Tunnel**: [docs/DOMAIN_SETUP.md](docs/DOMAIN_SETUP.md)
- **Cấu trúc Database**: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)

## 🛠 Tech Stack

- **Web**: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **API**: NestJS 11 (REST `/api/v1` + WebSocket socket.io + Swagger `/api/docs`)
- **Database**: PostgreSQL 16 với Prisma ORM (`packages/db`)
- **Cache & Queue**: Redis 7 (BullMQ)
- **Storage**: MinIO (S3 compatible)
- **Code Execution**: Judge0 CE (Docker)
- **Auth**: NextAuth v5 (Auth.js)
- **Monorepo**: pnpm 9 workspaces + Turborepo

```
apps/web        Next.js — giao diện, server actions, 2 worker BullMQ
apps/api        NestJS  — REST API, WebSocket, gửi email
packages/db     Prisma schema, migrations, seed, script bảo trì
packages/types  Zod schema + kiểu dữ liệu dùng chung
```

## 💻 Bắt đầu nhanh (Dev)

> ⚠️ **Máy đang chạy production?** Nếu `.env` đang trỏ vào hạ tầng thật
> (`192.168.53.x`) thì chạy `pnpm dev` sẽ **sửa thẳng vào dữ liệu học sinh**.
> Giữ hai hồ sơ cấu hình rồi chuyển qua lại — cả hai đều đã bị `.gitignore` chặn:
>
> ```bash
> cp .env.dev .env     # hạ tầng cục bộ, SMTP tắt (mail ghi ra log, không gửi thật)
> cp .env.prod .env    # hạ tầng thật
> ```
>
> Đổi `.env` xong: chạy dev thì khởi động lại `pnpm dev`; chạy Docker thì
> `docker compose -f docker-compose.prod.yml up -d --build` (phải build lại vì
> `NEXT_PUBLIC_*` nhúng lúc build). Hai chế độ **dùng chung cổng 3000/4000** nên
> phải dừng cái này mới chạy được cái kia.

Yêu cầu: **Node.js >= 20**, **pnpm 9**, **Docker Desktop**.

1. **Khởi động hạ tầng** (Postgres, Redis, MinIO, Judge0):

   ```bash
   docker compose up -d
   ```

2. **Tạo file cấu hình** — copy rồi sửa mật khẩu, `AUTH_SECRET`, `CRON_SECRET`:

   ```bash
   cp .env.example .env
   ```

3. **Cài dependencies** (tự sinh Prisma client):

   ```bash
   pnpm install
   ```

4. **Tạo bảng và dữ liệu mẫu**:

   ```bash
   pnpm db:migrate:deploy
   ```

   ```bash
   pnpm db:seed
   ```

5. **Chạy web + API** (turbo chạy song song cả hai):

   ```bash
   pnpm dev
   ```

6. **Chạy workers** — chỉ cần khi dùng chấm code / gửi email:

   ```bash
   # Terminal 2: worker chấm code
   pnpm worker:dev
   ```

   ```bash
   # Terminal 3: worker gửi mail
   pnpm worker:email
   ```

Mở http://localhost:3000 (giao diện) và http://localhost:4000/api/docs (Swagger).

> **Windows**: dừng hẳn `pnpm dev` trước khi chạy `prisma generate` / `pnpm build`,
> nếu không sẽ gặp lỗi EPERM do DLL của Prisma đang bị khoá.

## 🧪 Kiểm thử

```bash
pnpm test:db:up && pnpm test:api
```

```bash
pnpm test:e2e
```
