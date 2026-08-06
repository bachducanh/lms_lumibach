# syntax=docker/dockerfile:1
#
# Next.js web. Build từ GỐC repo:
#   docker build -f apps/web/Dockerfile -t lumibach/web .
#
# QUAN TRỌNG — những giá trị dưới đây được NHÚNG VÀO IMAGE LÚC BUILD, không đọc
# lại lúc chạy:
#   * NEXT_PUBLIC_*        → nhúng thẳng vào mã JS gửi xuống trình duyệt
#   * API_INTERNAL_URL     → Next.js sinh sẵn bảng rewrite lúc build
#   * MINIO_INTERNAL_*     → dùng trong rewrite /storage/*
# Đổi tên miền hoặc đổi địa chỉ nội bộ ⇒ phải build lại image.

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo


# ── Cài phụ thuộc + build ────────────────────────────────────────────────────
FROM base AS build

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME=LumiBach
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_WS_URL=
ARG NEXT_PUBLIC_MEDIA_URL=
ARG API_INTERNAL_URL=http://api:4000/api/v1
ARG MINIO_INTERNAL_ENDPOINT=localhost
ARG MINIO_INTERNAL_PORT=9000

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL \
    MINIO_INTERNAL_ENDPOINT=$MINIO_INTERNAL_ENDPOINT \
    MINIO_INTERNAL_PORT=$MINIO_INTERNAL_PORT \
    NEXT_TELEMETRY_DISABLED=1

COPY apps/web ./apps/web
RUN pnpm --filter @lumibach/web build

# KHÔNG dùng output standalone của Next.js ở đây.
#
# next.config đặt `serverExternalPackages: ['@lumibach/db']`, tức @lumibach/db
# phải tồn tại trong node_modules lúc chạy chứ không được bundle. Bản trace của
# standalone chỉ mang theo mỗi binary engine của Prisma và schema.prisma, thiếu
# hẳn phần JS của client — khởi động lên là
# "Prisma Client could not locate the Query Engine".
#
# pnpm deploy dựng node_modules thật (không symlink), đã loại devDependencies,
# và mang đủ @lumibach/db kèm generated client.
RUN pnpm deploy --filter=@lumibach/web --prod /out \
  && cp -r /repo/apps/web/.next /out/.next


# ── Image chạy thật ──────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Đặt quyền ngay trong COPY. `RUN chown -R` sau đó sẽ viết lại TOÀN BỘ file thành
# một layer trùng lặp, làm image phình gần gấp đôi.
COPY --from=build --chown=node:node /out ./

# Prisma bị Next.js bundle vào .next/server/chunks (vì @lumibach/db sinh client ra
# đường dẫn tuỳ chỉnh packages/db/generated/client, không phải @prisma/client).
# Bundle tìm binary engine CẠNH CHÍNH NÓ chứ không tìm trong node_modules, và mỗi
# chunk lại có gốc khác nhau. Danh sách đường dẫn Prisma dò (đọc từ log lỗi thật):
#
#   /app/.next/.prisma/client   /app/.next/server/chunks   /app/generated/client
#
# Chép vào một chỗ rồi liên kết sang các chỗ còn lại — thiếu bất kỳ chỗ nào thì
# một phần trang chạy được còn phần khác ném "could not locate the Query Engine".
COPY --from=build --chown=node:node /repo/packages/db/generated/client/ ./.prisma/client/
# Symlink và bản chép ở đây thuộc root, nhưng user `node` chỉ cần quyền ĐỌC nên
# không phải chown — tránh nhân đôi layer.
RUN mkdir -p /app/generated /app/.next/.prisma \
  && ln -s /app/.prisma/client /app/generated/client \
  && ln -s /app/.prisma/client /app/.next/.prisma/client \
  && cp /app/.prisma/client/libquery_engine-*.so.node /app/.prisma/client/schema.prisma /app/.next/server/chunks/

USER node

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node_modules/.bin/next", "start"]
