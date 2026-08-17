import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE_NAME, type EmailJobData } from '@lumibach/types';

/** Tách host/port/mật khẩu từ REDIS_URL cho bullmq. */
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

/**
 * Đẩy email vào hàng đợi để worker gửi.
 *
 * Vì sao API không tự gửi: máy chủ ứng dụng không có đường ra Internet nên
 * `transporter.sendMail` sẽ treo tới lúc timeout rồi vẫn hỏng. Trước đây
 * `register()` chờ đúng lời gọi đó, làm nút Đăng ký quay hàng chục giây và
 * người dùng không bao giờ nhận được email.
 *
 * Cấu hình phải khớp `apps/web/src/lib/queue.ts` — hai bên dùng chung một hàng
 * đợi Redis, lệch tên hoặc lệch db là job rơi vào chỗ không ai xử lý.
 */
@Injectable()
export class EmailQueue implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueue.name);
  private queue: Queue<EmailJobData> | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('Thiếu REDIS_URL — email sẽ gửi thẳng thay vì qua hàng đợi.');
      return;
    }
    this.queue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: parseRedisUrl(url),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }

  /**
   * Trả về true nếu đã xếp hàng thành công; false thì bên gọi tự gửi lấy.
   *
   * @param opts.once Chỉ gửi ĐÚNG một lần: hỏng là thôi, không thử lại. Dùng cho
   * email thông báo (xem ghi chú `EmailOptions` ở EmailService).
   * @param opts.dedupeKey Khoá chống trùng. BullMQ bỏ qua lời gọi `add` trùng
   * jobId với một job còn trong hàng, nên hai lần bấm duyệt liên tiếp chỉ sinh
   * một email.
   */
  async enqueue(
    to: string,
    subject: string,
    html: string,
    opts: { once?: boolean; dedupeKey?: string } = {}
  ): Promise<boolean> {
    if (!this.queue) return false;
    try {
      await this.queue.add(
        'send-raw',
        { kind: 'raw', to, subject, html },
        {
          ...(opts.once ? { attempts: 1 } : {}),
          ...(opts.dedupeKey ? { jobId: opts.dedupeKey } : {}),
        }
      );
      return true;
    } catch (err) {
      this.logger.error(`Không đẩy được email vào hàng đợi: ${(err as Error).message}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
