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
  'PRACTICE_TEST',
  'EXTERNAL_URL',
]);

export const AddModuleItemBodySchema = z.object({
  title: z.string().min(1),
  type: ModuleItemTypeSchema,
  lessonId: z.string().optional(),
  externalUrl: z.string().url().optional(),
});
export type AddModuleItemBody = z.infer<typeof AddModuleItemBodySchema>;

// ── Group settings per ModuleItem ──────────────────────────────

export const UpdateModuleItemGroupSettingsBodySchema = z
  .object({
    groupMode: z.enum(['NO_GROUPS', 'SEPARATE_GROUPS', 'VISIBLE_GROUPS']),
    groupIds: z.array(z.string().min(1)).optional(), // dùng cho VISIBLE_GROUPS
    groupingId: z.string().min(1).nullable().optional(), // dùng cho SEPARATE_GROUPS
  })
  .superRefine((data, ctx) => {
    if (data.groupMode === 'VISIBLE_GROUPS' && (!data.groupIds || data.groupIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['groupIds'],
        message: 'Chế độ "Nhóm hiện hữu" cần chọn ít nhất 1 nhóm.',
      });
    }
    if (data.groupMode === 'SEPARATE_GROUPS' && !data.groupingId) {
      ctx.addIssue({
        code: 'custom',
        path: ['groupingId'],
        message: 'Chế độ "Phân nhóm" cần chọn một Phân nhóm (Grouping).',
      });
    }
  });
export type UpdateModuleItemGroupSettingsBody = z.infer<
  typeof UpdateModuleItemGroupSettingsBodySchema
>;

export type ModuleItemGroupSettings = {
  groupMode: 'NO_GROUPS' | 'SEPARATE_GROUPS' | 'VISIBLE_GROUPS';
  groupingId: string | null;
  groupIds: string[]; // visible groups
};

// ── Query ──────────────────────────────────────────────────────

export const ModulesQuerySchema = z.object({
  courseId: z.string().min(1),
  publishedOnly: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional()
    .default(false),
});
export type ModulesQuery = z.infer<typeof ModulesQuerySchema>;

export const NavItemsQuerySchema = z.object({
  courseId: z.string().min(1),
  publishedOnly: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional()
    .default(false),
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
  practiceTestId: string | null;
  forumId: string | null;
  /** Đã đưa vào ngân hàng nội dung của danh mục khoá học chưa. */
  sharedToCategory?: boolean;
  groupMode: 'NO_GROUPS' | 'SEPARATE_GROUPS' | 'VISIBLE_GROUPS';
  groupingId: string | null;
  visibleGroupIds: string[];
  lesson?: { id: string; title: string; estimatedMinutes: number | null } | null;
  quiz?: { id: string; title: string; status: string } | null;
  codeExercise?: { id: string; title: string; language: string; status: string } | null;
  practiceTest?: { id: string; title: string; status: string } | null;
  forum?: { id: string; title: string } | null;
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
  practiceTestId: string | null;
  forumId: string | null;
  codeExercise?: { language: string } | null;
  practiceTest?: { status: string } | null;
};

// ── Ngân hàng nội dung dùng chung theo danh mục khoá học ───────

export const ShareContentBodySchema = z.object({
  shared: z.boolean(),
});
export type ShareContentBody = z.infer<typeof ShareContentBodySchema>;

export const ContentBankQuerySchema = z.object({
  /** Khoá học đang đứng — quyết định nhánh danh mục được phép nhìn. */
  courseId: z.string().min(1),
  q: z.string().trim().optional(),
  type: z.string().trim().optional(),
});
export type ContentBankQuery = z.infer<typeof ContentBankQuerySchema>;

export const CopyContentBodySchema = z.object({
  /** Chương của khoá đích sẽ nhận bản sao. */
  moduleId: z.string().min(1),
});
export type CopyContentBody = z.infer<typeof CopyContentBodySchema>;

export type ContentBankItem = {
  moduleItemId: string;
  type: string;
  title: string;
  updatedAt: string;
  sourceCourseId: string;
  sourceCourseName: string;
  sourceModuleName: string;
  /** Đường dẫn danh mục của khoá nguồn, ví dụ "2026-2027 / 12A1". */
  sourceCategoryPath: string;
  /** Mô tả ngắn theo loại: số câu hỏi, số test case, thời lượng… */
  detail: string;
};

export type ContentBankResult = {
  items: ContentBankItem[];
  /** Số khoá học đang góp nội dung mà khoá này nhìn thấy. */
  sourceCourseCount: number;
};
