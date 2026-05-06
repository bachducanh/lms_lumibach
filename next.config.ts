import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Warning: Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // Production: MinIO hostname từ env
      ...(process.env.MINIO_ENDPOINT && process.env.MINIO_ENDPOINT !== 'localhost'
        ? [
            {
              protocol: (process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http') as 'http' | 'https',
              hostname: process.env.MINIO_ENDPOINT,
              port: process.env.MINIO_USE_SSL === 'true' ? undefined : (process.env.MINIO_PORT ?? '9000'),
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
