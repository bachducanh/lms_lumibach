import nodemailer from 'nodemailer';

const isConfigured =
  !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD;

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

const FROM = process.env.SMTP_FROM ?? 'LumiBach <noreply@lumibach.local>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function send(to: string, subject: string, html: string) {
  if (!transporter) {
    // Trích link từ href trước khi xóa tags
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

    process.stdout.write('\n');
    process.stdout.write('┌─────────────────────────────────────────────────────┐\n');
    process.stdout.write('│  📧  EMAIL (DEV — chưa gửi thật)                   │\n');
    process.stdout.write('├─────────────────────────────────────────────────────┤\n');
    process.stdout.write(`│  To     : ${to.padEnd(41)}│\n`);
    process.stdout.write(`│  Subject: ${subject.slice(0, 41).padEnd(41)}│\n`);
    if (links[0]) {
      process.stdout.write('├─────────────────────────────────────────────────────┤\n');
      process.stdout.write(`│  🔗 ${links[0]}\n`);
    }
    process.stdout.write('└─────────────────────────────────────────────────────┘\n');
    process.stdout.write('\n');
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  await send(
    email,
    'Xác thực email - LumiBach',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#050E3C;margin-bottom:8px">Xác thực email</h2>
      <p style="color:#444;margin-bottom:24px">
        Nhấn vào nút bên dưới để xác thực địa chỉ email của bạn. Liên kết có hiệu lực trong <strong>24 giờ</strong>.
      </p>
      <a href="${url}"
         style="display:inline-block;background:#050E3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Xác thực email
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Nếu bạn không đăng ký tài khoản LumiBach, hãy bỏ qua email này.
      </p>
    </div>`
  );
}

export async function sendNotificationEmail(
  email: string,
  recipientName: string,
  title: string,
  body: string | null | undefined,
  link: string | null | undefined
) {
  const fullUrl = link ? (link.startsWith('http') ? link : `${APP_URL}${link}`) : null;
  await send(
    email,
    `${title} — LumiBach`,
    `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#050E3C;margin-bottom:8px">${title}</h2>
      <p style="color:#444;margin-bottom:4px">Xin chào <strong>${recipientName}</strong>,</p>
      ${body ? `<p style="color:#444;margin-bottom:20px">${body}</p>` : ''}
      ${fullUrl ? `<a href="${fullUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Xem chi tiết →</a>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px">
        Email tự động từ LumiBach LMS.
        <a href="${APP_URL}/settings/notifications" style="color:#7c3aed">Tắt thông báo email</a>
      </p>
    </div>`
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await send(
    email,
    'Đặt lại mật khẩu - LumiBach',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#050E3C;margin-bottom:8px">Đặt lại mật khẩu</h2>
      <p style="color:#444;margin-bottom:24px">
        Nhấn vào nút bên dưới để đặt lại mật khẩu. Liên kết có hiệu lực trong <strong>1 giờ</strong>.
      </p>
      <a href="${url}"
         style="display:inline-block;background:#DC0000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Đặt lại mật khẩu
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
      </p>
    </div>`
  );
}
