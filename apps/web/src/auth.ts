import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import type { UserRole } from '@lumibach/db';
import { isEmailIdentifier, normalizeUsername } from '@lumibach/types';

import '@/types/auth';

// `identifier` nhận cả email lẫn tên đăng nhập nên KHÔNG validate .email() ở
// đây. Ô nhập cũ tên là `email`; giữ lại làm phương án lùi để phiên đăng nhập
// đang mở và mọi chỗ gọi signIn() cũ không gãy khi triển khai bản này.
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(6),
  })
  .transform((d) => ({ identifier: d.identifier ?? d.email ?? '', password: d.password }))
  .refine((d) => d.identifier.length > 0, { message: 'Thiếu email hoặc tên đăng nhập' });

// Đặt ".lumibach.com" khi API nằm ở miền con (api.lumibach.com): cookie mặc định
// của NextAuth là host-only nên sẽ KHÔNG được gửi sang miền con, làm mọi request
// API trả 401. Để trống ở dev/LAN.
//
// Chỉ override sessionToken. TUYỆT ĐỐI không đặt domain cho csrfToken: cookie đó
// mang tiền tố `__Host-`, mà chuẩn cookie cấm `__Host-` có thuộc tính Domain —
// trình duyệt sẽ vứt cookie và đăng nhập hỏng hoàn toàn.
// CHỈ áp dụng khi web thật sự chạy trên HTTPS. Cookie này mang tên `__Secure-`
// và cờ secure=true nên trình duyệt từ chối nó trên http://localhost — tệ hơn,
// lúc đăng xuất NextAuth sẽ đi xoá đúng cái tên/domain đã cấu hình, không khớp
// cookie thật, khiến người dùng kẹt trong phiên và không đăng xuất nổi.
const cookieDomain = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://')
  ? process.env.AUTH_COOKIE_DOMAIN?.trim()
  : undefined;

// Phiên đăng nhập sống bao lâu kể từ lần hoạt động cuối (giờ).
//
// Máy phòng máy dùng chung: học sinh tiết trước hiếm khi bấm Đăng xuất, chỉ
// đóng tab hoặc bỏ đi. Mặc định của Auth.js là 30 NGÀY và cookie ghi kèm hạn
// nên đóng trình duyệt cũng không mất — tiết sau máy đó vẫn đang là phiên của
// bạn trước, mở ra thấy khoá học của lớp khác, và tệ hơn là làm bài hộ được.
// Rút xuống một buổi học, và trượt theo hoạt động nhờ `updateAge`: còn dùng thì
// còn gia hạn, bỏ đó quá lâu thì phải đăng nhập lại.
const SESSION_MAX_AGE_HOURS = Number(process.env.AUTH_SESSION_MAX_AGE_HOURS ?? 4);
const SESSION_MAX_AGE_SECONDS = Math.max(1, SESSION_MAX_AGE_HOURS) * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Gia hạn token khi người dùng còn hoạt động, tối đa 15 phút ghi lại một lần
    // để không phải ký lại JWT ở mọi request.
    updateAge: 15 * 60,
  },
  pages: {
    signIn: '/login',
  },
  ...(cookieDomain
    ? {
        cookies: {
          sessionToken: {
            name: '__Secure-authjs.session-token',
            options: {
              domain: cookieDomain,
              path: '/',
              httpOnly: true,
              // lumibach.com và api.lumibach.com là same-site (cùng domain đăng
              // ký) nên 'lax' vẫn gửi kèm cookie, không cần 'none'.
              sameSite: 'lax' as const,
              secure: true,
            },
          },
        },
      }
    : {}),
  providers: [
    Credentials({
      credentials: {
        identifier: { label: 'Email hoặc tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.error('[auth] invalid credentials shape:', parsed.error.issues);
          return null;
        }

        const { identifier, password } = parsed.data;

        // Email không phân biệt hoa thường trên thực tế, còn tên đăng nhập được
        // lưu ở dạng chữ thường — nên tra cứu cả hai bằng bản đã hạ chữ thường.
        const lookup = normalizeUsername(identifier);

        let user;
        try {
          user = await prisma.user.findFirst({
            where: {
              deletedAt: null,
              ...(isEmailIdentifier(identifier) ? { email: lookup } : { username: lookup }),
            },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
              fullName: true,
              avatar: true,
              role: true,
              status: true,
            },
          });
        } catch (err) {
          console.error('[auth] DB error:', err);
          return null;
        }

        if (!user) {
          console.error('[auth] user not found:', lookup);
          return null;
        }
        if (user.status !== 'ACTIVE') {
          console.error('[auth] user status not ACTIVE:', user.status, identifier);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          console.error('[auth] wrong password for:', identifier);
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        logActivity({ userId: user.id, action: 'LOGIN' });

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? `${user.firstName} ${user.lastName}`,
          image: user.avatar,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
        // Persist the avatar from DB into the JWT on sign-in so the
        // header's Avatar shows the existing image right after login
        // (NextAuth v5 doesn't auto-copy `image` → `picture` anymore).
        token.picture = user.image ?? null;
      }
      if (trigger === 'update' && session?.image !== undefined) {
        token.picture = session.image as string | null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as UserRole;
      // `token.picture` may legitimately be `null` (no avatar yet) — we
      // still want that mirrored into the session so the UI clears stale
      // images. Use `in` rather than `!== undefined` to detect "set".
      if ('picture' in token) session.user.image = token.picture as string | null;
      return session;
    },
  },
});
