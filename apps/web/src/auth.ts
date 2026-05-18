import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import type { UserRole } from '@lumibach/db';

import '@/types/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.error('[auth] invalid credentials shape:', parsed.error.issues);
          return null;
        }

        const { email, password } = parsed.data;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email, deletedAt: null },
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
          console.error('[auth] user not found:', email);
          return null;
        }
        if (user.status !== 'ACTIVE') {
          console.error('[auth] user status not ACTIVE:', user.status, email);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          console.error('[auth] wrong password for:', email);
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
      }
      if (trigger === 'update' && session?.image !== undefined) {
        token.picture = session.image as string | null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as UserRole;
      if (token.picture !== undefined) session.user.image = token.picture as string | null;
      return session;
    },
  },
});
