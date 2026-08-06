import { NextResponse } from 'next/server';

// NextAuth v5 cookie names (dev HTTP vs prod HTTPS).
const NEXTAUTH_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
];

/**
 * Server Component layouts can READ cookies but cannot DELETE them
 * (Next.js restriction — that's only allowed in Route Handlers or
 * Server Actions). The (dashboard)/layout detects stale sessions
 * (JWT references a user the DB no longer has) and redirects here;
 * we wipe every NextAuth cookie and bounce to /login.
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const reason = url.searchParams.get('reason') ?? 'session-stale';
  const redirectTo = `/login?reason=${encodeURIComponent(reason)}`;

  // Location TƯƠNG ĐỐI có chủ đích. `NextResponse.redirect()` đòi URL tuyệt đối
  // và sẽ dựng nó từ `req.url` — sau Cloudflare Tunnel, Next.js chuẩn hoá req.url
  // về `localhost:3000`, nên người dùng ở lumibach.com bị ném về localhost.
  // Location tương đối được trình duyệt tự ghép với origin nó đang truy cập, nên
  // đúng ở cả localhost lẫn tên miền mà không cần biết mình đang chạy ở đâu.
  const res = new NextResponse(null, { status: 303, headers: { Location: redirectTo } });
  // Overwrite each cookie with an immediately-expired empty value.
  // To reliably evict cookies that were originally set with `Secure` /
  // `__Host-` / `__Secure-` prefixes (which NextAuth uses when
  // NEXTAUTH_URL is https://), the deletion response MUST repeat those
  // attributes — otherwise browsers treat it as a different cookie and
  // ignore the eviction.
  for (const name of NEXTAUTH_COOKIE_NAMES) {
    const isSecurePrefix = name.startsWith('__Secure-') || name.startsWith('__Host-');
    res.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      // `__Host-` / `__Secure-` prefixed cookies REQUIRE the Secure flag
      // by spec; matching it ensures the browser actually erases them.
      secure: isSecurePrefix,
    });
  }
  return res;
}
