'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { requireRole } from '@/lib/permissions';
import { auditLog } from '@/lib/audit';
import type { UserRole } from '@prisma/client';
import type { ActionResult } from './auth';

// ── Schemas ──────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự'),
  role: z.enum(['ADMIN', 'TEACHER', 'TA', 'STUDENT']),
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'TA', 'STUDENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});

// ── Helper: generate password ngẫu nhiên ────────────────────

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let pwd =
    (upper[Math.floor(Math.random() * upper.length)] ?? 'A') +
    (digits[Math.floor(Math.random() * digits.length)] ?? '2');
  for (let i = 0; i < 6; i++) {
    pwd += all[Math.floor(Math.random() * all.length)] ?? 'a';
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ── Actions ───────────────────────────────────────────────────

export async function createUserAction(
  input: z.infer<typeof createUserSchema>,
): Promise<ActionResult<{ password: string }>> {
  const session = await auth();
  requireRole(session?.user?.role as UserRole, 'ADMIN');

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Dữ liệu không hợp lệ.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { email, fullName, role, phone, username } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(username ? [{ username }] : [])], deletedAt: null },
  });
  if (existing) {
    const field = existing.email === email ? 'Email' : 'Tên đăng nhập';
    return { success: false, error: `${field} này đã được sử dụng.` };
  }

  const plainPassword = parsed.data.password || generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName;
  const lastName = parts.at(-1) ?? '';

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      firstName,
      lastName,
      passwordHash,
      role: role as UserRole,
      status: 'ACTIVE',
      emailVerified: new Date(),
      ...(phone ? { phone } : {}),
      ...(username ? { username } : {}),
    },
  });

  await auditLog({
    userId: session!.user.id,
    userRole: session!.user.role,
    action: 'CREATE_USER',
    resource: 'User',
    resourceId: user.id,
    changes: { email, role, fullName },
  });

  return { success: true, message: 'Tạo tài khoản thành công.', data: { password: plainPassword } };
}

export async function updateUserAction(
  userId: string,
  input: z.infer<typeof updateUserSchema>,
): Promise<ActionResult> {
  const session = await auth();
  requireRole(session?.user?.role as UserRole, 'ADMIN');

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before || before.deletedAt) return { success: false, error: 'Không tìm thấy người dùng.' };

  const data: Record<string, unknown> = {};
  if (parsed.data.fullName) {
    data.fullName = parsed.data.fullName;
    const parts = parsed.data.fullName.trim().split(/\s+/);
    data.firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parsed.data.fullName;
    data.lastName = parts.at(-1) ?? '';
  }
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
  if (parsed.data.username !== undefined) data.username = parsed.data.username || null;

  await prisma.user.update({ where: { id: userId }, data });

  await auditLog({
    userId: session!.user.id,
    userRole: session!.user.role,
    action: 'UPDATE_USER',
    resource: 'User',
    resourceId: userId,
    changes: { before: { role: before.role, status: before.status }, after: data },
  });

  return { success: true, message: 'Cập nhật thành công.' };
}

export async function softDeleteUserAction(userId: string): Promise<ActionResult> {
  const session = await auth();
  requireRole(session?.user?.role as UserRole, 'ADMIN');

  if (session!.user.id === userId) {
    return { success: false, error: 'Không thể xóa chính tài khoản của bạn.' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return { success: false, error: 'Không tìm thấy người dùng.' };

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: 'INACTIVE' } });

  await auditLog({
    userId: session!.user.id,
    userRole: session!.user.role,
    action: 'DELETE_USER',
    resource: 'User',
    resourceId: userId,
  });

  return { success: true, message: 'Đã xóa người dùng.' };
}

export async function resetUserPasswordAction(
  userId: string,
): Promise<ActionResult<{ password: string }>> {
  const session = await auth();
  requireRole(session?.user?.role as UserRole, 'ADMIN');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return { success: false, error: 'Không tìm thấy người dùng.' };

  const newPassword = generatePassword();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await auditLog({
    userId: session!.user.id,
    userRole: session!.user.role,
    action: 'RESET_PASSWORD',
    resource: 'User',
    resourceId: userId,
  });

  return { success: true, message: 'Mật khẩu đã được đặt lại.', data: { password: newPassword } };
}

// ── Import từ Excel ──────────────────────────────────────────

export type ImportRow = {
  fullName: string;
  email: string;
  username?: string;
  role?: UserRole;
};

export type ImportResult = {
  success: number;
  errors: { row: number; email: string; reason: string }[];
  passwords: { fullName: string; email: string; password: string }[];
};

export async function importUsersAction(rows: ImportRow[]): Promise<ActionResult<ImportResult>> {
  const session = await auth();
  requireRole(session?.user?.role as UserRole, 'ADMIN');

  const result: ImportResult = { success: 0, errors: [], passwords: [] };

  for (const [i, row] of rows.entries()) {
    const rowNum = i + 2; // Excel row 1 = header

    if (!row.email || !row.fullName) {
      result.errors.push({ row: rowNum, email: row.email || '', reason: 'Thiếu họ tên hoặc email.' });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      result.errors.push({ row: rowNum, email: row.email, reason: 'Email không hợp lệ.' });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: row.email } });
    if (existing) {
      result.errors.push({ row: rowNum, email: row.email, reason: 'Email đã tồn tại.' });
      continue;
    }

    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const parts = row.fullName.trim().split(/\s+/);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : row.fullName;
    const lastName = parts.at(-1) ?? '';

    await prisma.user.create({
      data: {
        email: row.email,
        fullName: row.fullName,
        firstName,
        lastName,
        passwordHash,
        role: (row.role ?? 'STUDENT') as UserRole,
        status: 'ACTIVE',
        emailVerified: new Date(),
        ...(row.username ? { username: row.username } : {}),
      },
    });

    result.success++;
    result.passwords.push({ fullName: row.fullName, email: row.email, password: plainPassword });
  }

  await auditLog({
    userId: session!.user.id,
    userRole: session!.user.role,
    action: 'IMPORT_USERS',
    metadata: { total: rows.length, success: result.success, errors: result.errors.length },
  });

  return { success: true, message: `Import xong: ${result.success} thành công, ${result.errors.length} lỗi.`, data: result };
}

// ── Cập nhật profile bản thân ────────────────────────────────

const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự').optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});

export async function updateProfileAction(
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const data: Record<string, unknown> = {};
  if (parsed.data.fullName) {
    data.fullName = parsed.data.fullName;
    const parts = parsed.data.fullName.trim().split(/\s+/);
    data.firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parsed.data.fullName;
    data.lastName = parts.at(-1) ?? '';
  }
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
  if (parsed.data.username !== undefined) data.username = parsed.data.username || null;

  await prisma.user.update({ where: { id: session.user.id }, data });

  return { success: true, message: 'Hồ sơ đã được cập nhật.' };
}
