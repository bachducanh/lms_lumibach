/**
 * Email worker — chạy riêng biệt:
 *   pnpm worker:email
 *
 * Nhận job từ queue 'email' và gửi qua nodemailer.
 *
 * Tiến trình này là NƠI DUY NHẤT thật sự gửi email, nên nó phải chạy trên máy
 * có đường ra Internet tới smtp.gmail.com:587. Máy chủ ứng dụng (.103) không có
 * Internet — xem docs/DEVELOPMENT.md.
 */

import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '@lumibach/types';
import { redisConnection, type EmailJobData } from '@/lib/queue';
import { sendNotificationEmail, sendRawEmail } from '@/lib/email';

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    // `kind` vắng mặt = email thông báo. Job cũ nằm sẵn trong Redis từ trước
    // khi thêm trường này cũng rơi vào nhánh đây, nên nâng cấp không mất việc.
    if (data.kind === 'raw') {
      console.log(`[email-worker] Sending to ${data.to}: ${data.subject}`);
      await sendRawEmail(data.to, data.subject, data.html);
    } else {
      console.log(`[email-worker] Sending to ${data.to}: ${data.title}`);
      await sendNotificationEmail(data.to, data.recipientName, data.title, data.body, data.link);
    }

    console.log(`[email-worker] Sent to ${data.to}`);
  },
  { connection: redisConnection, concurrency: 5 }
);

worker.on('failed', (job, err) => {
  console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
});

console.log('[email-worker] started');
