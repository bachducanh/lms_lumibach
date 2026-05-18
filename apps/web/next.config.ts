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
  serverExternalPackages: ['@lumibach/db'],
  allowedDevOrigins: ['lumi.nextgentra.com', '*.nextgentra.com'],
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
