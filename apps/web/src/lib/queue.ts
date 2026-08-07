import { Queue } from 'bullmq';
import { EMAIL_QUEUE_NAME, type EmailJobData } from '@lumibach/types';

export type { EmailJobData };

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || 'localhost',
      port: u.port ? parseInt(u.port) : 6379,
      password: u.password || undefined,
      db: u.pathname ? parseInt(u.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

export const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6379');

const QUEUE_OPTIONS = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
} as const;

let _emailQueue: Queue<EmailJobData> | null = null;

/**
 * Hàng đợi email. Người đẩy việc vào: lib/notifications.ts (cron nhắc hạn nộp
 * bài, báo cáo tham gia) và apps/api (email xác thực, đặt lại mật khẩu). Người
 * xử lý: workers/email.worker.ts — **phải chạy như một tiến trình riêng**, xem
 * service `worker` trong docker-compose.prod.yml. Không chạy nó thì email nằm
 * im trong Redis.
 *
 * (Trước đây còn hàng đợi 'code-execution', nay bỏ: API gọi thẳng Judge0.)
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!_emailQueue) _emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, QUEUE_OPTIONS);
  return _emailQueue;
}
