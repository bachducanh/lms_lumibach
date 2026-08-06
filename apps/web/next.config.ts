import type { NextConfig } from 'next';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

const monorepoRoot = path.resolve(process.cwd(), '../..');
loadDotenv({ path: path.resolve(monorepoRoot, '.env') });

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: monorepoRoot,
  serverExternalPackages: ['@lumibach/db', 'archiver'],
  // socket.io luôn gọi `/socket.io/?EIO=4&...` — CÓ dấu `/` cuối. Mặc định Next.js
  // chuyển hướng 308 để bỏ dấu đó, và việc này xảy ra TRƯỚC rewrite nên request
  // không bao giờ tới được NestJS. Tắt đi thì rewrite `/socket.io/*` bên dưới mới
  // có tác dụng. Ứng dụng nội bộ, không làm SEO nên không ảnh hưởng gì khác.
  skipTrailingSlashRedirect: true,
  // Origin được phép tải tài nguyên dev (/_next/*) khi không phải localhost.
  // DEV_ALLOWED_ORIGINS (ngăn cách bằng dấu phẩy) để thêm IP LAN của máy chủ khi
  // chia sẻ cho máy khác trong mạng — IP do DHCP cấp nên hay đổi, đặt qua .env
  // tiện hơn sửa file này.
  allowedDevOrigins: [
    'lumibach.com',
    '*.lumibach.com',
    ...(process.env.DEV_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ],
  async rewrites() {
    const internalBase =
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api/v1';
    const apiRoot = internalBase.replace(/\/api\/v1$/, '');
    const minioInternal = `http://${process.env.MINIO_INTERNAL_ENDPOINT ?? 'localhost'}:${process.env.MINIO_INTERNAL_PORT ?? '9000'}`;
    return [
      // Proxy NestJS API calls so they work behind any tunnel/reverse-proxy
      { source: '/api/v1/:path*', destination: `${apiRoot}/api/v1/:path*` },
      // Proxy MinIO storage so images work on HTTPS domains (avoids Mixed Content)
      { source: '/storage/:path*', destination: `${minioInternal}/:path*` },
      // socket.io qua HTTP long-polling. Rewrite KHÔNG proxy được WebSocket, nên
      // đây chỉ là đường dự phòng — nhưng nhờ nó mà realtime và chấm code vẫn
      // chạy khi chưa cấu hình được rule `path: ^/socket\.io` ở cloudflared.
      // Khi rule đó có rồi, socket.io tự nâng cấp lên WebSocket, không phải sửa gì.
      { source: '/socket.io/:path*', destination: `${apiRoot}/socket.io/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // Miền media công khai (NEXT_PUBLIC_MEDIA_URL, ví dụ https://media.lumibach.com):
      // ảnh phục vụ thẳng từ MinIO qua Cloudflare thay vì đi xuyên tiến trình Next.js.
      ...(() => {
        if (!process.env.NEXT_PUBLIC_MEDIA_URL) return [];
        try {
          const u = new URL(process.env.NEXT_PUBLIC_MEDIA_URL);
          return [
            {
              protocol: u.protocol.replace(':', '') as 'http' | 'https',
              hostname: u.hostname,
              ...(u.port ? { port: u.port } : {}),
              pathname: '/**',
            },
          ];
        } catch {
          return [];
        }
      })(),
      ...(process.env.MINIO_ENDPOINT && process.env.MINIO_ENDPOINT !== 'localhost'
        ? [
            {
              protocol: (process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http') as
                | 'http'
                | 'https',
              hostname: process.env.MINIO_ENDPOINT,
              port:
                process.env.MINIO_USE_SSL === 'true'
                  ? undefined
                  : (process.env.MINIO_PORT ?? '9000'),
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
