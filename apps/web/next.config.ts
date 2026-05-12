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
