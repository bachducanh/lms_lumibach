import { auth } from '@/auth';

export const proxy = (req: any) => {
  // Bỏ qua nếu là Server Action để tránh lỗi 'Failed to fetch'
  if (req.headers.get('next-action')) return;
  return auth(req);
};

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|scratch-gui|favicon.ico|login|register|forgot-password|reset-password|verify-email).*)',
  ],
};
