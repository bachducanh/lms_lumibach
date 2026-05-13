import { z } from 'zod';

// ── Lesson CRUD ────────────────────────────────────────────────

export const CreateLessonBodySchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  title: z.string().min(1, 'Tiêu đề không được trống'),
  content: z.string().default(''),
  estimatedMinutes: z.number().int().positive().optional(),
});
export type CreateLessonBody = z.infer<typeof CreateLessonBodySchema>;

export const UpdateLessonBodySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
});
export type UpdateLessonBody = z.infer<typeof UpdateLessonBodySchema>;

// ── Completion ─────────────────────────────────────────────────

export const MarkCompleteBodySchema = z.object({
  moduleItemId: z.string().min(1),
});
export type MarkCompleteBody = z.infer<typeof MarkCompleteBodySchema>;

// ── Response types ─────────────────────────────────────────────

export type LessonDetail = {
  id: string;
  title: string;
  content: string;
  estimatedMinutes: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  moduleItems: {
    id: string;
    isPublished: boolean;
    module: { id: string; name: string; courseId: string };
  }[];
  attachments: {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }[];
};
