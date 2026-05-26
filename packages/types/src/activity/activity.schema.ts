import { z } from 'zod';

/**
 * Zod schemas + types cho module activity.
 *
 * SINGLE SOURCE OF TRUTH — FE dùng cho react-hook-form resolver, BE dùng qua
 * nestjs-zod để validate request. KHÔNG duplicate Zod schema ở apps/.
 */

/** Enum mirror Prisma ActivityAction. Khi schema.prisma đổi, sync ở đây. */
export const ActivityActionSchema = z.enum([
  'VIEW_COURSE',
  'VIEW_LESSON',
  'START_QUIZ',
  'SUBMIT_QUIZ',
  'VIEW_PRACTICE_TEST',
  'START_PRACTICE_TEST',
  'SUBMIT_PRACTICE_TEST',
  'VIEW_ASSIGNMENT',
  'SUBMIT_ASSIGNMENT',
  'SUBMIT_CODE',
  'VIEW_EXERCISE',
  'LOGIN',
]);
export type ActivityActionValue = z.infer<typeof ActivityActionSchema>;

/** Common filter shape — page + date range + action. */
const baseFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  action: ActivityActionSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

/** GET /activities/course/:courseSlug query */
export const CourseLogsQuerySchema = baseFiltersSchema.extend({
  userId: z.string().optional(),
});
export type CourseLogsQuery = z.infer<typeof CourseLogsQuerySchema>;

/** GET /activities/system query (ADMIN) */
export const SystemLogsQuerySchema = baseFiltersSchema.extend({
  userId: z.string().optional(),
  courseId: z.string().optional(),
  q: z.string().min(1).max(100).optional(),
});
export type SystemLogsQuery = z.infer<typeof SystemLogsQuerySchema>;

/** GET /activities/student/:userId query */
export const StudentLogsQuerySchema = baseFiltersSchema.extend({
  courseId: z.string().optional(),
});
export type StudentLogsQuery = z.infer<typeof StudentLogsQuerySchema>;

/** Row shape — flat user + optional course nested. */
export const ActivityLogRowSchema = z.object({
  id: z.string(),
  action: ActivityActionSchema,
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  resourceName: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  user: z.object({
    id: z.string(),
    fullName: z.string().nullable(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    role: z.string(),
  }),
  course: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
});
export type ActivityLogRow = z.infer<typeof ActivityLogRowSchema>;

export const ActivityLogPageSchema = z.object({
  rows: z.array(ActivityLogRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});
export type ActivityLogPage = z.infer<typeof ActivityLogPageSchema>;

/** Course summary cho dropdown filter. */
export const CourseFilterOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type CourseFilterOption = z.infer<typeof CourseFilterOptionSchema>;
