import * as Minio from 'minio';

const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';

export const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';
export const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';

export const minioClient = new Minio.Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin_password',
});

export function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY);
}

export async function ensureBucket(bucket: string): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    // Cho phép đọc public (avatar là public)
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
  const protocol = useSSL ? 'https' : 'http';
  return `${protocol}://${endpoint}:${port}/${bucket}/${objectName}`;
}
