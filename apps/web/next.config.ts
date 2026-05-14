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
  allowedDevOrigins: ['lumi.nextgentra.com', '*.nextgentra.com'],
  async rewrites() {
    // Proxy browser API calls through Next.js server so they work behind
    // any tunnel/reverse-proxy (lumi.nextgentra.com) without CORS issues.
    // Server-side requests bypass this rewrite and call API_INTERNAL_URL directly.
    const internalBase =
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api/v1';
    const apiRoot = internalBase.replace(/\/api\/v1$/, '');
    return [{ source: '/api/v1/:path*', destination: `${apiRoot}/api/v1/:path*` }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
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
