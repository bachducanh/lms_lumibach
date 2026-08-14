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
# Corepack hỏi xác nhận trước khi tải bản pnpm khai trong packageManager. BuildKit
# không cấp stdin nên câu hỏi đó không bao giờ được trả lời: build sạch (chưa có
# layer cache) đứng im vô hạn ở bước `pnpm install`, không báo lỗi gì.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# fontconfig + một font thật: watermark ảnh bàn giao vẽ chữ bằng SVG rồi để
# librsvg (trong sharp) dựng. Image slim không có font nào, librsvg vẫn chạy
# nhưng phần <text> ra trống — ảnh lưu được mà không có dòng giờ/phòng/người
# mượn, đúng thứ khiến ảnh có giá trị đối chiếu.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl ca-certificates fontconfig fonts-dejavu-core \
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
# Hai bước sau bước deploy, cả hai đều bắt buộc — thiếu bước nào thì mọi route
# dùng gói native đều trả 500 NGAY LÚC NẠP MODULE (trước cả khi kiểm đăng nhập):
#
# 1. `rm -rf /out/.next`. pnpm deploy đã chép sẵn một bản `.next` nhưng BỎ QUA
#    mọi thư mục `node_modules` bên trong. `cp -r … /out/.next` gặp thư mục đã
#    tồn tại nên lồng bản build thật vào `/out/.next/.next` — Next.js không đọc
#    chỗ đó, và image mang hai bản build.
#
# 2. Trỏ lại các symlink trong `.next/node_modules/`. Turbopack không để
#    `require('sharp')` nguyên văn: nó sinh `.next/node_modules/sharp-<hash>`
#    trỏ vào kho `.pnpm` của REPO rồi require qua đó (mọi gói native đều vậy,
#    kể cả gói đã khai trong serverExternalPackages). Đường dẫn ấy chỉ đúng ở
#    cây `/repo/apps/web`; trong image gốc package là `/app` nên nó trỏ trượt.
#
#    Giữ NGUYÊN phần đuôi `.pnpm/<gói>@<phiên bản>/node_modules/<gói>` của đích
#    cũ, chỉ thay phần gốc thành `../../node_modules/` — tính từ
#    `/app/.next/node_modules/` ra đúng `/app/node_modules/.pnpm/…`, nơi
#    `pnpm deploy` dựng lại kho với TÊN THƯ MỤC Y HỆT kho của repo.
#
#    Đừng quay lại lối cắt `-<hash>` khỏi tên rồi trỏ vào `node_modules/<gói>`
#    tầng đầu. Hai chỗ hỏng:
#      • Phụ thuộc GIÁN TIẾP không có ở tầng đầu. `exceljs` kéo theo
#        unzipper → fstream → rimraf@2.7.1, và Turbopack sinh symlink cho nó.
#      • Hai phiên bản của cùng một gói (đang có archiver@5.3.2 và archiver@8.0.0)
#        cắt hash xong ra cùng một tên, nên cả hai trỏ về một chỗ và một phiên
#        bản bị nuốt mất trong im lặng.
RUN pnpm deploy --filter=@lumibach/web --prod /out \
  && rm -rf /out/.next \
  && cp -r /repo/apps/web/.next /out/.next \
  && for d in /out/.next/node_modules/*; do \
       [ -L "$d" ] || continue; \
       t=$(readlink "$d"); duoi=${t#*node_modules/}; \
       rm -f "$d"; ln -s "../../node_modules/$duoi" "$d"; \
       [ -e "$d" ] || { echo "Symlink hong: $d -> $duoi"; exit 1; }; \
     done


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
