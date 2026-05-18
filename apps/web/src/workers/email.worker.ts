/**
 * Email worker — chạy riêng biệt:
 *   pnpm worker:email
 *
 * Nhận job từ queue 'email', gửi notification email qua nodemailer.
 */

import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { redisConnection, type EmailJobData } from '@/lib/queue';
import { sendNotificationEmail } from '@/lib/email';

const worker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    const { to, recipientName, title, body, link } = job.data;
    console.log(`[email-worker] Sending to ${to}: ${title}`);
    await sendNotificationEmail(to, recipientName, title, body, link);
    console.log(`[email-worker] Sent to ${to}`);
  },
  { connection: redisConnection, concurrency: 5 }
);

worker.on('failed', (job, err) => {
  console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
});

console.log('[email-worker] started');
