import * as Minio from 'minio';

// Internal endpoint: used by the server-side SDK to connect to MinIO directly.
// Must be reachable from the Node.js process (localhost or internal network).
// Falls back to MINIO_ENDPOINT so single-machine setups keep working.
const internalEndpoint =
  process.env.MINIO_INTERNAL_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost';
const internalPort = parseInt(
  process.env.MINIO_INTERNAL_PORT ?? process.env.MINIO_PORT ?? '9000',
  10
);

export const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';
export const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';

export const minioClient = new Minio.Client({
  endPoint: internalEndpoint,
  port: internalPort,
  useSSL: false, // internal connection is always plain HTTP
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin_password',
});

export function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY);
}

export async function ensureBucket(bucket: string): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
    await minioClient.setBucketPolicy(bucket, policy);
  }
}

export function getPublicUrl(bucket: string, objectName: string): string {
  // Return a relative /storage/... URL so it works on any domain (localhost, lumi.nextgentra.com).
  // Next.js rewrites /storage/:path* → MinIO internally, avoiding Mixed Content on HTTPS.
  return `/storage/${bucket}/${objectName}`;
}
