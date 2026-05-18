import type { UserRole } from '@lumibach/db';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }

  interface JWT {
    id: string;
    role: UserRole;
  }
}
