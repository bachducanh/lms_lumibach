# syntax=docker/dockerfile:1
#
# NestJS API. Build từ GỐC repo, không phải từ thư mục này:
#   docker build -f apps/api/Dockerfile -t lumibach/api .
#
# Dùng node:20-slim (Debian) thay vì Alpine: Prisma chạy ổn định hơn trên glibc,
# tránh phải khai báo binaryTargets musl và những lỗi engine khó lần.

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl là phụ thuộc thời gian chạy của Prisma engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo


# ── Cài phụ thuộc + build ────────────────────────────────────────────────────
FROM base AS build

# Chép trước phần khai báo để tận dụng cache: đổi mã nguồn không phải cài lại.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# postinstall của repo sẽ chạy prisma generate + build @lumibach/db và
# @lumibach/types, nên cần schema có mặt trước khi install.
COPY packages ./packages

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

COPY apps/api ./apps/api
RUN pnpm --filter @lumibach/api build

# Gom thành thư mục tự chứa: node_modules thật (không phải symlink của pnpm),
# đã loại devDependencies.
RUN pnpm deploy --filter=@lumibach/api --prod /out


# ── Image chạy thật ──────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Đặt quyền ngay trong COPY. `RUN chown -R` sau đó sẽ viết lại TOÀN BỘ file thành
# một layer trùng lặp, làm image phình gần gấp đôi.
COPY --from=build --chown=node:node /out ./

# Không chạy bằng root.
USER node

EXPOSE 4000

# Biến môi trường được nạp lúc chạy qua env_file/environment của compose —
# image KHÔNG chứa .env.
CMD ["node", "dist/main.js"]
