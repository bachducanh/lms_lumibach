'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { createEmailVerificationToken, createPasswordResetToken } from '@/lib/tokens';
import { auth } from '@/auth';

// ── Schemas ──────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Cần có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Cần có ít nhất 1 chữ số'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Cần có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Cần có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Cần có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Cần có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

// ── Types ─────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; message: string; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ── Actions ───────────────────────────────────────────────────

export async function checkLoginStatus(
  email: string,
): Promise<'ok' | 'pending' | 'suspended' | 'not_found'> {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    select: { status: true },
  });
  if (!user) return 'not_found';
  if (user.status === 'PENDING') return 'pending';
  if (user.status === 'SUSPENDED') return 'suspended';
  return 'ok';
}

export async function registerAction(
  input: z.infer<typeof registerSchema>,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dữ liệu không hợp lệ.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, fullName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: 'Email này đã được đăng ký.' };
  }

  // Tách fullName thành firstName/lastName
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.slice(0, -1).join(' ') || fullName;
  const lastName = parts.at(-1) ?? '';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      firstName,
      lastName,
      passwordHash,
      role: 'STUDENT',
      status: 'PENDING',
    },
  });

  const token = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(email, token);

  return {
    success: true,
    message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
  };
}

export async function forgotPasswordAction(
  input: z.infer<typeof forgotPasswordSchema>,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Email không hợp lệ.' };
  }

  // Luôn trả về success để không lộ email có tồn tại hay không
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email, deletedAt: null },
  });

  if (user && user.status !== 'SUSPENDED') {
    const token = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, token);
  }

  return {
    success: true,
    message:
      'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút.',
  };
}

export async function resetPasswordAction(
  input: z.infer<typeof resetPasswordSchema>,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dữ liệu không hợp lệ.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { token, password } = parsed.data;

  const record = await prisma.passwordReset.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập.' };
}

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.',
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    }),
    prisma.emailVerificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Email xác thực thành công! Bạn có thể đăng nhập.' };
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });

  if (!user || user.status !== 'PENDING') {
    return { success: true, message: 'Nếu tài khoản tồn tại, email xác thực đã được gửi lại.' };
  }

  const token = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(user.email, token);

  return { success: true, message: 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.' };
}

export async function changePasswordAction(
  input: z.infer<typeof changePasswordSchema>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dữ liệu không hợp lệ.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) return { success: false, error: 'Không tìm thấy tài khoản.' };

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Mật khẩu hiện tại không đúng.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { success: true, message: 'Mật khẩu đã được thay đổi thành công.' };
}
