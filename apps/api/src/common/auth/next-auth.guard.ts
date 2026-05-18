import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@lumibach/db';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { AuthUser, NextAuthJwtPayload } from './auth.types';
import { getAuthJwt } from './jwt-loader';

// NextAuth v5 cookie names (dev HTTP vs prod HTTPS).
// Salt for JWE decryption = cookie name itself.
const NEXTAUTH_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

@Injectable()
export class NextAuthGuard implements CanActivate {
  private readonly logger = new Logger(NextAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const cookies = (req.cookies ?? {}) as Record<string, string>;

    let token: string | undefined;
    let salt: string | undefined;
    for (const name of NEXTAUTH_COOKIE_NAMES) {
      if (cookies[name]) {
        token = cookies[name];
        salt = name;
        break;
      }
    }

    if (!token || !salt) {
      throw new UnauthorizedException('Missing session cookie');
    }

    const secret = this.configService.getOrThrow<string>('AUTH_SECRET');

    let payload: NextAuthJwtPayload | null;
    try {
      const { decode } = await getAuthJwt();
      payload = await decode({ token, secret, salt });
    } catch (err) {
      this.logger.debug(`JWE decode failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid session token');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid session token');
    }

    const userId = payload.id ?? payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Session token missing user id');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`User status: ${user.status}`);
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
    req.user = authUser;
    return true;
  }
}
