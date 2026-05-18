import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@lumibach/db';
import type { Socket } from 'socket.io';
import { getAuthJwt } from '../auth/jwt-loader';
import type { AuthUser } from '../auth/auth.types';

const COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(';').map((c) => {
      const eq = c.indexOf('=');
      if (eq === -1) return [c.trim(), ''];
      return [c.slice(0, eq).trim(), decodeURIComponent(c.slice(eq + 1).trim())];
    })
  );
}

export async function wsAuthenticate(
  client: Socket,
  config: ConfigService,
  prisma: PrismaClient
): Promise<AuthUser | null> {
  const cookieHeader = (client.handshake.headers.cookie as string | undefined) ?? '';
  const cookies = parseCookies(cookieHeader);

  let token: string | undefined;
  let salt: string | undefined;
  for (const name of COOKIE_NAMES) {
    if (cookies[name]) {
      token = cookies[name];
      salt = name;
      break;
    }
  }

  if (!token || !salt) return null;

  const secret = config.get<string>('AUTH_SECRET');
  if (!secret) return null;

  try {
    const { decode } = await getAuthJwt();
    const payload = await decode({ token, secret, salt });
    if (!payload) return null;

    const userId = payload.id ?? payload.sub;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') return null;
    return user as AuthUser;
  } catch {
    return null;
  }
}
