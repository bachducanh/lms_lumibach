import type { UserRole, UserStatus } from '@lumibach/db';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: UserStatus;
};

export type NextAuthJwtPayload = {
  id?: string;
  role?: string;
  email?: string;
  name?: string;
  picture?: string | null;
  sub?: string;
  iat?: number;
  exp?: number;
  jti?: string;
};

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
