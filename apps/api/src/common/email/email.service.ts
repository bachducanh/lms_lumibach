import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { EmailQueue } from './email.queue';

const LOG_FILE = path.join(process.cwd(), 'logs', 'dev-emails.log');

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly appUrl: string;

  private logToFile(line: string) {
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch (err) {
      this.logger.warn(`Không ghi được log email vào file: ${(err as Error).message}`);
    }
  }

  constructor(
    private readonly config: ConfigService,
    private readonly queue: EmailQueue
  ) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASSWORD');

    this.from = config.get<string>('SMTP_FROM') ?? 'LumiBach <noreply@lumibach.local>';
    this.appUrl = config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port: Number(config.get('SMTP_PORT') ?? 587),
            secure: config.get('SMTP_SECURE') === 'true',
            auth: { user, pass },
            // Chặn trên thời gian chờ. Mặc định nodemailer chờ tới ~2 phút khi
            // máy không có đường ra Internet. Chỉ dùng cho nhánh gửi thẳng dự
            // phòng — đường chính đã đi qua hàng đợi.
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
          })
        : null;
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      process.stdout.write('\n┌─────────────────────────────────────────────────────┐\n');
      process.stdout.write('│  📧  EMAIL (DEV — chưa gửi thật)                   │\n');
      process.stdout.write('├─────────────────────────────────────────────────────┤\n');
      process.stdout.write(`│  To     : ${to.slice(0, 41).padEnd(41)}│\n`);
      process.stdout.write(`│  Subject: ${subject.slice(0, 41).padEnd(41)}│\n`);
      if (links[0]) {
        process.stdout.write('├─────────────────────────────────────────────────────┤\n');
        process.stdout.write(`│  🔗 ${links[0]}\n`);
      }
      process.stdout.write('└─────────────────────────────────────────────────────┘\n\n');
      this.logToFile(
        `[DEV - chưa gửi thật] to=${to} subject="${subject}" link=${links[0] ?? '(không có)'}`
      );
      return;
    }

    // Đường chính: xếp hàng rồi trả về ngay. Worker (chạy trên máy có Internet)
    // sẽ gửi, kèm 3 lần thử lại. TUYỆT ĐỐI không await sendMail ở đây — máy chủ
    // ứng dụng không ra được Internet nên lời gọi đó treo nguyên request.
    if (await this.queue.enqueue(to, subject, html)) return;

    // Dự phòng khi không có Redis (chạy lẻ, hoặc Redis chết): gửi thẳng. Trên
    // máy có Internet thì vẫn tới nơi; trên máy chủ thì hỏng sau 10 giây chứ
    // không treo, và link vẫn được ghi lại ở dưới.
    this.logger.warn('Hàng đợi không dùng được — gửi thẳng, request có thể chậm.');
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`SMTP send failed, falling back to stdout: ${(err as Error).message}`);
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      process.stdout.write('\n┌─────────────────────────────────────────────────────┐\n');
      process.stdout.write('│  📧  EMAIL (SMTP FAILED — fallback stdout)          │\n');
      process.stdout.write('├─────────────────────────────────────────────────────┤\n');
      process.stdout.write(`│  To     : ${to.slice(0, 41).padEnd(41)}│\n`);
      process.stdout.write(`│  Subject: ${subject.slice(0, 41).padEnd(41)}│\n`);
      if (links[0]) {
        process.stdout.write('├─────────────────────────────────────────────────────┤\n');
        process.stdout.write(`│  🔗 ${links[0]}\n`);
      }
      process.stdout.write('└─────────────────────────────────────────────────────┘\n\n');
      this.logToFile(
        `[SMTP FAILED - fallback] to=${to} subject="${subject}" link=${links[0] ?? '(không có)'}`
      );
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const url = `${this.appUrl}/verify-email?token=${token}`;
    // Always log the verification URL so admins can debug delivery
    // issues (Gmail spam folder, blocked domain, etc.) without
    // exposing the token in logs we wouldn't otherwise have.
    process.stdout.write(`[email] verify URL for ${email}: ${url}\n`);
    this.logToFile(`[verify-email] to=${email} url=${url}`);
    await this.send(
      email,
      'Xác thực email - LumiBach',
      `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#050E3C;margin-bottom:8px">Xác thực email</h2>
        <p style="color:#444;margin-bottom:24px">
          Nhấn vào nút bên dưới để xác thực địa chỉ email của bạn. Liên kết có hiệu lực trong <strong>24 giờ</strong>.
        </p>
        <a href="${url}" style="display:inline-block;background:#050E3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Xác thực email
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">
          Nếu bạn không đăng ký tài khoản LumiBach, hãy bỏ qua email này.
        </p>
      </div>`
    );
  }

  /**
   * Email thông báo của module Phòng chức năng.
   *
   * Đi qua cùng đường `send()` như email xác thực: xếp hàng đợi rồi trả về
   * ngay, vì máy chủ ứng dụng không có đường ra Internet.
   *
   * @param extraHtml Khối HTML phụ chèn dưới nội dung chính — dùng để đính kèm
   * nội quy phòng khi đơn được duyệt.
   */
  async sendRoomBookingEmail(params: {
    to: string;
    subject: string;
    heading: string;
    intro: string;
    lines: { label: string; value: string }[];
    ctaLabel?: string;
    ctaPath?: string;
    extraHtml?: string;
  }) {
    const { to, subject, heading, intro, lines, ctaLabel, ctaPath, extraHtml } = params;
    const url = ctaPath ? `${this.appUrl}${ctaPath}` : null;

    const bangThongTin = lines
      .map(
        (l) =>
          `<tr>
            <td style="padding:4px 12px 4px 0;color:#888;white-space:nowrap;vertical-align:top">${l.label}</td>
            <td style="padding:4px 0;color:#222">${l.value}</td>
          </tr>`
      )
      .join('');

    await this.send(
      to,
      subject,
      `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="color:#050E3C;margin-bottom:8px">${heading}</h2>
        <p style="color:#444;margin-bottom:16px">${intro}</p>
        <table style="border-collapse:collapse;font-size:14px;margin-bottom:24px">${bangThongTin}</table>
        ${
          url && ctaLabel
            ? `<a href="${url}" style="display:inline-block;background:#050E3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">${ctaLabel}</a>`
            : ''
        }
        ${extraHtml ?? ''}
        <p style="color:#888;font-size:12px;margin-top:24px">
          Email tự động từ hệ thống LumiBach. Vui lòng không trả lời email này.
        </p>
      </div>`
    );
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${this.appUrl}/reset-password?token=${token}`;
    // Ghi lại như email xác thực: khi email không tới nơi (worker chết, Gmail
    // chặn, hộp thư rác) thì quản trị viên vẫn lấy được link từ log.
    process.stdout.write(`[email] reset URL for ${email}: ${url}\n`);
    this.logToFile(`[reset-password] to=${email} url=${url}`);
    await this.send(
      email,
      'Đặt lại mật khẩu - LumiBach',
      `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#050E3C;margin-bottom:8px">Đặt lại mật khẩu</h2>
        <p style="color:#444;margin-bottom:24px">
          Nhấn vào nút bên dưới để đặt lại mật khẩu. Liên kết có hiệu lực trong <strong>1 giờ</strong>.
        </p>
        <a href="${url}" style="display:inline-block;background:#DC0000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Đặt lại mật khẩu
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
        </p>
      </div>`
    );
  }
}
