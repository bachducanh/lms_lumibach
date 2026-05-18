import { z } from 'zod';
import type { CategoryBreadcrumb } from '../categories/categories.schema';

// ── Course CRUD ────────────────────────────────────────────────

export const CourseStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const CreateCourseBodySchema = z.object({
  name: z.string().min(3, 'Tên khoá học tối thiểu 3 ký tự'),
  shortName: z.string().max(20).optional().or(z.literal('')),
  description: z.string().optional(),
  subject: z.string().optional(),
  categoryId: z.string().min(1, 'Vui lòng chọn danh mục (lớp học)'),
  status: CourseStatusSchema.default('DRAFT'),
  isPublic: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  thumbnail: z.string().optional(),
});
export type CreateCourseBody = z.infer<typeof CreateCourseBodySchema>;

export const UpdateCourseBodySchema = CreateCourseBodySchema.partial();
export type UpdateCourseBody = z.infer<typeof UpdateCourseBodySchema>;

export const CoursesQuerySchema = z.object({
  q: z.string().optional(),
  status: CourseStatusSchema.optional(),
  categoryId: z.string().min(1).optional(),
  includeSubcategories: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional()
    .default(false),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(12),
  ownOnly: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
});
export type CoursesQuery = z.infer<typeof CoursesQuerySchema>;

// ── Response types ─────────────────────────────────────────────

export type CourseOwner = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email?: string;
  avatar?: string | null;
};

export type CourseCategoryRef = {
  id: string;
  name: string;
  slug: string;
  breadcrumb: CategoryBreadcrumb;
};

export type CourseListItem = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  thumbnail: string | null;
  subject: string | null;
  categoryId: string;
  category: CourseCategoryRef;
  status: string;
  isPublic: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  owner: CourseOwner;
  _count: { enrollments: number };
};

export type CourseDetail = CourseListItem & {
  description: string | null;
  enrollmentCode: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  ownerId: string;
};
