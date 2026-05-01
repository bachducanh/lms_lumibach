import { Queue } from 'bullmq';

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host:     u.hostname || 'localhost',
      port:     u.port ? parseInt(u.port) : 6379,
      password: u.password || undefined,
      db:       u.pathname ? parseInt(u.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

export const redisConnection = parseRedisUrl(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
);

export type CodeExecutionJobData = {
  submissionId: string;
};

const QUEUE_OPTIONS = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts:           3,
    backoff:            { type: 'exponential', delay: 5_000 },
    removeOnComplete:   { count: 100 },
    removeOnFail:       { count: 50 },
  },
} as const;

let _codeQueue: Queue<CodeExecutionJobData> | null = null;

export function getCodeQueue(): Queue<CodeExecutionJobData> {
  if (!_codeQueue) _codeQueue = new Queue<CodeExecutionJobData>('code-execution', QUEUE_OPTIONS);
  return _codeQueue;
}

