# Hướng dẫn Setup môi trường Development - LMS_LumiBach

> Hướng dẫn chi tiết từng bước để setup môi trường development trên máy tính của bạn. Theo đúng thứ tự, không skip bước nào.

**Đối tượng**: Solo developer mới bắt đầu dự án
**Thời gian dự kiến**: 2-4 giờ cho lần setup đầu tiên
**OS hỗ trợ**: Windows 10/11, macOS, Ubuntu/Linux

---

## Mục lục

1. [Cài đặt công cụ cơ bản](#1-cài-đặt-công-cụ-cơ-bản)
2. [Setup VS Code](#2-setup-vs-code)
3. [Setup Git và GitHub](#3-setup-git-và-github)
4. [Khởi tạo Next.js Project](#4-khởi-tạo-nextjs-project)
5. [Setup Docker và Services](#5-setup-docker-và-services)
6. [Setup Database với Prisma](#6-setup-database-với-prisma)
7. [Setup NextAuth](#7-setup-nextauth)
8. [Setup shadcn/ui](#8-setup-shadcnui)
9. [Setup Linting và Formatting](#9-setup-linting-và-formatting)
10. [Setup Testing](#10-setup-testing)
11. [Verify mọi thứ hoạt động](#11-verify-mọi-thứ-hoạt-động)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Cài đặt công cụ cơ bản

### Node.js 20 LTS

**Windows/macOS**: Tải từ [nodejs.org](https://nodejs.org/) - chọn LTS version (20.x)

**macOS với Homebrew**:
```bash
brew install node@20
```

**Linux với nvm** (khuyến nghị):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20
```

**Verify**:
```bash
node --version  # phải là v20.x.x
npm --version
```

### pnpm (Package Manager)

pnpm nhanh hơn npm 2-3 lần và tiết kiệm disk space. Bắt buộc dùng pnpm cho dự án này.

```bash
npm install -g pnpm
```

**Verify**:
```bash
pnpm --version  # phải là 8.x trở lên
```

### Docker Desktop

Docker để chạy PostgreSQL, Redis, MinIO, Judge0 trên local.

**Windows/macOS**: Tải [Docker Desktop](https://www.docker.com/products/docker-desktop/) và cài đặt.

**Linux (Ubuntu)**:
```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install Docker Engine
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group (để không cần sudo)
sudo usermod -aG docker $USER
# Logout và login lại
```

**Verify**:
```bash
docker --version
docker compose version
docker run hello-world  # test
```

### Git

**Windows**: Tải [Git for Windows](https://git-scm.com/download/win)

**macOS**: 
```bash
brew install git
```

**Linux**:
```bash
sudo apt install git -y
```

**Config Git**:
```bash
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input  # Windows
```

---

## 2. Setup VS Code

### Cài VS Code

Tải từ [code.visualstudio.com](https://code.visualstudio.com/)

### Extensions cần thiết

Mở VS Code, vào tab Extensions (Ctrl+Shift+X) và cài:

**Bắt buộc**:
- `Prisma` - Hỗ trợ Prisma schema
- `Tailwind CSS IntelliSense` - Autocomplete Tailwind
- `ESLint` - Linting
- `Prettier - Code formatter` - Format code
- `Error Lens` - Hiển thị error inline
- `GitLens` - Git history visualization
- `Pretty TypeScript Errors` - Đọc TS errors dễ hơn

**Khuyến nghị**:
- `Auto Rename Tag` - Auto rename HTML/JSX tags
- `Path Intellisense` - Autocomplete file paths
- `Thunder Client` - Test API trong VS Code
- `Vietnamese Language Pack` - Giao diện tiếng Việt (tùy chọn)
- `GitHub Copilot` - AI code completion (nếu có subscription)

### VS Code settings

Tạo file `.vscode/settings.json` trong workspace:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## 3. Setup Git và GitHub

### Tạo SSH key

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter để dùng default location
# Đặt passphrase nếu muốn (khuyến nghị)
```

**Add SSH key vào ssh-agent**:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

**Copy public key**:
```bash
# macOS
pbcopy < ~/.ssh/id_ed25519.pub

# Linux
cat ~/.ssh/id_ed25519.pub | xclip -selection clipboard

# Windows (PowerShell)
Get-Content ~/.ssh/id_ed25519.pub | clip
```

### Add SSH key vào GitHub

1. Vào [GitHub Settings → SSH Keys](https://github.com/settings/keys)
2. Click "New SSH key"
3. Paste public key
4. Save

**Test connection**:
```bash
ssh -T git@github.com
```

### Tạo private repo

1. Vào [GitHub New Repository](https://github.com/new)
2. Tên: `lumibach`
3. Chọn **Private**
4. KHÔNG init README/gitignore/license (sẽ tạo từ local)
5. Create repository

---

## 4. Khởi tạo Next.js Project

### Tạo project

Tạo folder cho dự án và mở terminal trong đó:

```bash
mkdir lumibach
cd lumibach
```

Tạo Next.js project:

```bash
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
```

Khi được hỏi:
- TypeScript: **Yes**
- ESLint: **No** (sẽ setup sau)
- Tailwind CSS: **Yes**
- src/ directory: **Yes**
- App Router: **Yes**
- Customize default import alias: **No** (dùng @/*)

### Test project chạy

```bash
pnpm dev
```

Mở browser tại http://localhost:3000 - thấy trang Next.js mặc định là OK.

Nhấn `Ctrl+C` để dừng.

### Tạo file .gitignore

Next.js đã tạo .gitignore cơ bản, thêm vào những thứ sau:

```bash
# Đảm bảo .gitignore có những dòng này
cat >> .gitignore << 'EOF'

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite

# Logs
logs/
*.log

# IDE
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/

# Testing
coverage/
.nyc_output/

# Backup files
*.bak
*.backup

# Uploaded files (during dev)
uploads/
EOF
```

### Init Git và commit đầu tiên

```bash
git init
git add .
git commit -m "chore: khởi tạo dự án LMS_LumiBach"

# Connect với GitHub
git remote add origin git@github.com:[username]/lumibach.git
git branch -M main
git push -u origin main
```

### Tạo branches

```bash
git checkout -b develop
git push -u origin develop

# Tạo branch feature đầu tiên
git checkout -b feature/initial-setup
```

---

## 5. Setup Docker và Services

### Tạo docker-compose.yml

Tạo file `docker-compose.yml` ở root project:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: lumibach-postgres
    environment:
      POSTGRES_USER: lumibach
      POSTGRES_PASSWORD: lumibach_dev_password
      POSTGRES_DB: lumibach_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lumibach"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: lumibach-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: lumibach-minio
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin_dev_password
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Judge0 - sẽ setup ở Tuần 13, comment lại bây giờ
  # judge0:
  #   image: judge0/judge0:1.13.0
  #   ...

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Khởi động services

```bash
docker compose up -d
```

Kiểm tra services chạy:

```bash
docker compose ps
```

Tất cả phải có status `Up` và `healthy`.

### Test connection

**PostgreSQL**:
```bash
docker compose exec postgres psql -U lumibach -d lumibach_dev -c "SELECT version();"
```

**Redis**:
```bash
docker compose exec redis redis-cli ping
# Phải return PONG
```

**MinIO**: Mở browser tại http://localhost:9001
- User: minioadmin
- Password: minioadmin_dev_password

### Tạo file .env.local

```bash
cp .env.example .env.local 2>/dev/null || touch .env.local
```

Mở `.env.local` và thêm:

```env
# Database
DATABASE_URL="postgresql://lumibach:lumibach_dev_password@localhost:5432/lumibach_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL="false"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin_dev_password"
MINIO_BUCKET_AVATARS="lumibach-avatars"
MINIO_BUCKET_FILES="lumibach-files"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="đổi-thành-random-string-dài-và-an-toàn"

# Email (cho dev có thể để trống, dùng Mailhog hoặc tương tự)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@lumibach.local"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="LMS_LumiBach"

# Judge0 (sẽ setup sau)
JUDGE0_API_URL=""
JUDGE0_API_KEY=""
```

**Tạo NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

Copy output và paste vào `NEXTAUTH_SECRET`.

### Tạo .env.example

Copy `.env.local` thành `.env.example` và xóa giá trị thật, chỉ để placeholder:

```bash
cp .env.local .env.example
# Sau đó edit .env.example, thay giá trị thật bằng placeholder
```

Commit `.env.example` (không commit `.env.local`):

```bash
git add .env.example docker-compose.yml
git commit -m "chore: setup docker services và env example"
```

---

## 6. Setup Database với Prisma

### Cài Prisma

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

### Init Prisma

```bash
npx prisma init
```

Lệnh này tạo:
- `prisma/schema.prisma`
- Cập nhật `.env` với DATABASE_URL (đã có)

### Schema cơ bản

Mở `prisma/schema.prisma` và tạo schema cơ bản (sẽ mở rộng dần):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  
  firstName     String
  lastName      String
  fullName      String?
  
  role          UserRole  @default(STUDENT)
  status        UserStatus @default(ACTIVE)
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  
  @@index([email])
  @@index([role])
}

enum UserRole {
  ADMIN
  TEACHER
  TA
  STUDENT
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING
}
```

### Run migration đầu tiên

```bash
npx prisma migrate dev --name init
```

Khi được hỏi tên migration, đặt là `init`.

### Tạo Prisma Client singleton

Tạo file `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Test database

Tạo file `src/app/test-db/page.tsx` để test:

```typescript
import { prisma } from '@/lib/db';

export default async function TestDB() {
  const userCount = await prisma.user.count();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Database Test</h1>
      <p>Tổng số user: {userCount}</p>
    </div>
  );
}
```

Chạy `pnpm dev` và truy cập http://localhost:3000/test-db - phải thấy "Tổng số user: 0".

### Prisma Studio

Để xem database GUI:

```bash
npx prisma studio
```

Mở http://localhost:5555 - Prisma Studio cho phép xem và edit data.

Xóa file test-db sau khi xong.

---

## 7. Setup NextAuth

### Cài NextAuth v5

```bash
pnpm add next-auth@beta @auth/prisma-adapter
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

### Cập nhật Prisma schema

Thêm models cho NextAuth vào `prisma/schema.prisma`:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

Cập nhật model User để có relations:

```prisma
model User {
  // ... fields cũ
  
  accounts Account[]
  sessions Session[]
}
```

Run migration:

```bash
npx prisma migrate dev --name add_auth_tables
```

### Tạo NextAuth config

Tạo file `src/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        
        const user = await prisma.user.findUnique({
          where: { email, deletedAt: null },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName || `${user.firstName} ${user.lastName}`,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
```

### Tạo API route cho NextAuth

Tạo file `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
export { GET, POST } from '@/auth';
```

### Tạo middleware

Tạo file `src/middleware.ts`:

```typescript
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register).*)'],
};
```

---

## 8. Setup shadcn/ui

### Init shadcn/ui

```bash
pnpm dlx shadcn-ui@latest init
```

Trả lời các câu hỏi:
- TypeScript: **Yes**
- Style: **Default** (hoặc New York nếu thích)
- Base color: **Slate**
- CSS variables: **Yes**
- tailwind.config: **tailwind.config.ts**
- Components: `@/components`
- Utils: `@/lib/utils`
- React Server Components: **Yes**

### Cài components cơ bản

```bash
pnpm dlx shadcn-ui@latest add button input label form card toast dropdown-menu avatar badge separator
```

Test một component - tạo `src/app/page.tsx`:

```typescript
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">LMS_LumiBach</h1>
      <Button>Hello LumiBach!</Button>
    </main>
  );
}
```

Chạy `pnpm dev` - thấy button đẹp là OK.

---

## 9. Setup Linting và Formatting

### Cài ESLint

```bash
pnpm add -D eslint eslint-config-next @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Tạo file `.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "warn",
    "react/no-unescaped-entities": "off"
  }
}
```

### Cài Prettier

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

Tạo file `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "arrowParens": "always",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Tạo file `.prettierignore`:

```
node_modules
.next
dist
build
*.lock
prisma/migrations
```

### Cài Husky cho pre-commit hooks

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

Tạo file `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

Thêm vào `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

### Update scripts trong package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit"
  }
}
```

Test:

```bash
pnpm format
pnpm lint
pnpm type-check
```

---

## 10. Setup Testing

### Cài Vitest

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Tạo file `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Tạo file `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

### Cài Playwright (E2E)

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

Tạo file `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Update scripts

Thêm vào `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 11. Verify mọi thứ hoạt động

Chạy checklist sau, mỗi bước phải PASS:

### Database
```bash
docker compose ps  # postgres phải up và healthy
npx prisma studio  # mở được Prisma Studio
```

### Type checking
```bash
pnpm type-check  # không có error
```

### Linting
```bash
pnpm lint  # pass
pnpm format:check  # pass
```

### Build
```bash
pnpm build  # build thành công
```

### Dev server
```bash
pnpm dev  # chạy được, mở http://localhost:3000
```

### Tests
```bash
pnpm test:run  # pass (hiện tại chưa có test)
```

### Git
```bash
git status  # clean
git log --oneline  # thấy commits
```

---

## 12. Troubleshooting

### Lỗi: "Cannot connect to database"

**Nguyên nhân**: PostgreSQL container chưa chạy hoặc DATABASE_URL sai.

**Giải pháp**:
```bash
docker compose ps  # check postgres status
docker compose restart postgres
docker compose logs postgres  # xem logs
```

Verify DATABASE_URL trong `.env.local` đúng.

### Lỗi: "Port 3000 already in use"

**Giải pháp**:
```bash
# macOS/Linux
lsof -i :3000
kill -9 [PID]

# Windows
netstat -ano | findstr :3000
taskkill /PID [PID] /F
```

Hoặc đổi port: `pnpm dev -- -p 3001`

### Lỗi: "Prisma Client not generated"

**Giải pháp**:
```bash
npx prisma generate
```

Sau khi sửa schema:
```bash
npx prisma migrate dev
npx prisma generate
```

### Lỗi: "Module not found: @/..."

**Giải pháp**: Verify `tsconfig.json` có:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Lỗi: Docker container "unhealthy"

**Giải pháp**:
```bash
docker compose down
docker compose up -d
docker compose logs [service-name]
```

Nếu vẫn không được, xóa volumes và làm lại:
```bash
docker compose down -v
docker compose up -d
```

> ⚠️ Lệnh trên xóa toàn bộ data trong DB local!

### Permission errors trên Linux

```bash
sudo chown -R $USER:$USER .
```

---

## Bước tiếp theo

Sau khi setup xong, bạn đã sẵn sàng để code module đầu tiên (Authentication). Quay lại file `TODO.md` và bắt đầu với **Tuần 3: Authentication UI và Logic**.

### Commit progress

```bash
git add .
git commit -m "chore: hoàn thành setup môi trường development"
git push origin feature/initial-setup

# Tạo PR và merge vào develop
```

### Resources hữu ích

- [Next.js App Router docs](https://nextjs.org/docs/app)
- [Prisma docs](https://www.prisma.io/docs)
- [shadcn/ui components](https://ui.shadcn.com/)
- [NextAuth v5 (Auth.js)](https://authjs.dev/)
- [Tailwind CSS docs](https://tailwindcss.com/docs)

---

## Checklist hoàn thành

Sau khi xong tất cả các bước, bạn phải có:

- [ ] Node.js 20, pnpm, Docker, Git, VS Code đã cài
- [ ] SSH key đã add vào GitHub
- [ ] Repository private đã tạo trên GitHub
- [ ] Next.js project đã init với TypeScript + Tailwind + App Router
- [ ] Docker services chạy: PostgreSQL, Redis, MinIO
- [ ] File `.env.local` đã config đầy đủ
- [ ] Prisma schema có User model, migration đã run
- [ ] NextAuth đã config (chưa hoạt động hoàn toàn, nhưng có config)
- [ ] shadcn/ui đã setup, có components cơ bản
- [ ] ESLint, Prettier, Husky đã setup
- [ ] Vitest, Playwright đã cài
- [ ] `pnpm dev` chạy thành công
- [ ] `pnpm type-check`, `pnpm lint` pass
- [ ] Code đã push lên GitHub

Nếu tất cả đều OK, bạn đã sẵn sàng bắt đầu code thật!

---

**Chúc bạn setup thành công!** 🚀
