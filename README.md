# LumiBach LMS

Hệ thống quản lý học tập (Learning Management System) hiện đại được xây dựng với Next.js, Prisma, PostgreSQL, Redis, MinIO và Judge0.

## 🚀 Tài liệu hướng dẫn

- **Hướng dẫn cài đặt Development**: [docs/SETUP.md](docs/SETUP.md)
- **Hướng dẫn triển khai Server (Production)**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Cấu trúc Database**: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Cache & Queue**: Redis (BullMQ)
- **Storage**: MinIO (S3 compatible)
- **Code Execution**: Judge0 (Docker)
- **Styling**: Tailwind CSS & Shadcn UI

## 💻 Bắt đầu nhanh (Dev)

1. **Khởi động hạ tầng**:
   ```bash
   docker compose up -d
   ```

2. **Cài đặt dependencies**:
   ```bash
   pnpm install
   ```

3. **Chạy ứng dụng**:
   ```bash
   pnpm dev
   ```

4. **Chạy workers**:
   ```bash
   # Terminal 1: Worker chấm code
   pnpm worker:dev

   # Terminal 2: Worker gửi mail
   pnpm worker:email
   ```

Mở [http://localhost:3000](http://localhost:3000) để xem kết quả.
