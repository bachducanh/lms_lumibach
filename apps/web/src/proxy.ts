import { auth } from '@/auth';
import type { NextAuthRequest } from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server';

const authProxy: NextMiddleware = auth(
  (_req: NextAuthRequest, _event: NextFetchEvent): ReturnType<NextMiddleware> => undefined
);

/** Trang công khai về tài khoản — chạy qua proxy chỉ để ép https, không qua Auth.js. */
const AUTH_PAGES = /^\/(login|register|forgot-password|reset-password|verify-email)(\/|$)/;

/** localhost / IP (dev, máy trong LAN, gọi nội bộ trên máy chủ) không có https. */
function isLocalOrIp(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.startsWith('[') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * Ép https cho tên miền thật.
 *
 * Cloudflare vẫn phục vụ được http://lumibach.com (chưa bật "Always Use HTTPS"),
 * nên ai gõ "lumibach.com" hay mở link cũ là vào bằng http: mật khẩu đăng nhập
 * đi qua mạng không mã hoá, và trình duyệt tắt các tính năng chỉ dành cho kết nối
 * an toàn — chia sẻ màn hình khi làm quiz có giám sát báo "không hỗ trợ".
 *
 * Giao thức người dùng thật sự dùng nằm ở `x-forwarded-proto` do Cloudflare gắn
 * (Auth.js cũng đọc header này). Tên miền lấy từ header chứ không từ nextUrl:
 * sau tunnel, Next.js chuẩn hoá nextUrl về localhost:3000.
 */
function redirectToHttps(req: NextRequest): NextResponse | null {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (proto !== 'http') return null;

  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  const hostname = host?.replace(/:\d+$/, '') ?? '';
  if (!hostname || isLocalOrIp(hostname)) return null;

  const target = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, `https://${hostname}`);
  return NextResponse.redirect(target, 308);
}

export const proxy = (req: NextRequest, event: NextFetchEvent) => {
  // Bỏ qua nếu là Server Action để tránh lỗi 'Failed to fetch'
  if (req.headers.get('next-action')) return;

  const toHttps = redirectToHttps(req);
  if (toHttps) return toHttps;

  if (AUTH_PAGES.test(req.nextUrl.pathname)) return;
  return authProxy(req, event);
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|scratch-gui|favicon.ico).*)'],
};
