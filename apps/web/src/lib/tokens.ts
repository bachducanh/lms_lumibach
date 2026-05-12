import { randomBytes } from 'crypto';
import { prisma } from './db';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Xóa token cũ trước khi tạo mới
  await prisma.passwordReset.deleteMany({ where: { userId } });

  const token = generateToken();
  await prisma.passwordReset.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 giờ
    },
  });

  return token;
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 giờ
    },
  });

  return token;
}
