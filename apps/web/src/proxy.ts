import { auth } from '@/auth';
import type { NextAuthRequest } from 'next-auth';
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server';

const authProxy: NextMiddleware = auth(
  (_req: NextAuthRequest, _event: NextFetchEvent): ReturnType<NextMiddleware> => undefined
);

export const proxy = (req: NextRequest, event: NextFetchEvent) => {
  // Bỏ qua nếu là Server Action để tránh lỗi 'Failed to fetch'
  if (req.headers.get('next-action')) return;
  return authProxy(req, event);
};

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|scratch-gui|favicon.ico|login|register|forgot-password|reset-password|verify-email).*)',
  ],
};
