import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'TEACHER', 'TA', 'STUDENT']);
export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']);

// ── Admin: create user ─────────────────────────────────────────

export const CreateUserBodySchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự'),
  role: UserRoleSchema,
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;

// ── Admin: update user ─────────────────────────────────────────

export const UpdateUserBodySchema = z.object({
  fullName: z.string().min(2).optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

// ── Update own profile ─────────────────────────────────────────

export const UpdateProfileBodySchema = z.object({
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự').optional(),
  phone: z.string().optional(),
  username: z.string().min(3).optional().or(z.literal('')),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;

// ── Import rows ────────────────────────────────────────────────

export const ImportRowSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  username: z.string().optional(),
  role: UserRoleSchema.optional(),
  password: z.string().optional(),
  courseSlugs: z.array(z.string()).optional(),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

export const ImportUsersBodySchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
});
export type ImportUsersBody = z.infer<typeof ImportUsersBodySchema>;

// ── Response types ─────────────────────────────────────────────

export type ImportResult = {
  success: number;
  errors: { row: number; email: string; reason: string }[];
  passwords: { fullName: string; email: string; password: string }[];
  enrollments: { email: string; enrolled: string[]; missing: string[] }[];
};

// ── Students list ──────────────────────────────────────────────

export const StudentsQuerySchema = z.object({
  q: z.string().optional(),
  courseId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
});
export type StudentsQuery = z.infer<typeof StudentsQuerySchema>;

export type StudentRow = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { enrollments: number };
};

export type StudentEnrollment = {
  id: string;
  courseId: string;
  courseName: string;
  courseSlug: string;
  status: string;
  progress: number;
  enrolledAt: string;
  quizScore: number | null;
  codeScore: number | null;
};

export type StudentDetail = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  enrollments: StudentEnrollment[];
};
