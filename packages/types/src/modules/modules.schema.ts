import { z } from 'zod';

// ── Module CRUD ────────────────────────────────────────────────

export const CreateModuleBodySchema = z.object({
  courseId: z.string().min(1),
  name: z.string().min(1, 'Tên chương không được trống'),
  description: z.string().optional(),
});
export type CreateModuleBody = z.infer<typeof CreateModuleBodySchema>;

export const UpdateModuleBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateModuleBody = z.infer<typeof UpdateModuleBodySchema>;

export const ReorderModulesBodySchema = z.object({
  courseId: z.string().min(1),
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderModulesBody = z.infer<typeof ReorderModulesBodySchema>;

export const ReorderItemsBodySchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderItemsBody = z.infer<typeof ReorderItemsBodySchema>;

// ── Module items ───────────────────────────────────────────────

export const ModuleItemTypeSchema = z.enum([
  'LESSON',
  'ASSIGNMENT',
  'QUIZ',
  'CODE_EXERCISE',
  'EXTERNAL_URL',
]);

export const AddModuleItemBodySchema = z.object({
  title: z.string().min(1),
  type: ModuleItemTypeSchema,
  lessonId: z.string().optional(),
  externalUrl: z.string().url().optional(),
});
export type AddModuleItemBody = z.infer<typeof AddModuleItemBodySchema>;

// ── Query ──────────────────────────────────────────────────────

export const ModulesQuerySchema = z.object({
  courseId: z.string().min(1),
  publishedOnly: z.coerce.boolean().optional().default(false),
});
export type ModulesQuery = z.infer<typeof ModulesQuerySchema>;

export const NavItemsQuerySchema = z.object({
  courseId: z.string().min(1),
  publishedOnly: z.coerce.boolean().optional().default(false),
});
export type NavItemsQuery = z.infer<typeof NavItemsQuerySchema>;

// ── Response types ─────────────────────────────────────────────

export type ModuleItemSummary = {
  id: string;
  type: string;
  position: number;
  title: string;
  lessonId: string | null;
  externalUrl: string | null;
  isPublished: boolean;
  assignmentId: string | null;
  quizId: string | null;
  codeExerciseId: string | null;
  lesson?: { id: string; title: string; estimatedMinutes: number | null } | null;
  quiz?: { id: string; title: string; status: string } | null;
  codeExercise?: { id: string; title: string; language: string; status: string } | null;
};

export type ModuleWithItems = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  items: ModuleItemSummary[];
};

export type CourseNavItem = {
  id: string;
  title: string;
  type: string;
  lessonId: string | null;
  assignmentId: string | null;
  quizId: string | null;
  codeExerciseId: string | null;
  codeExercise?: { language: string } | null;
};
