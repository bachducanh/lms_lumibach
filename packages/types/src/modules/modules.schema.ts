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
  /**
   * Nội dung vào ngân hàng bằng hai đường:
   * - `BANK`   — soạn thẳng trong ngân hàng của danh mục, không thuộc lớp nào.
   * - `COURSE` — của một lớp cụ thể, được giáo viên lớp đó bật chia sẻ.
   */
  sourceKind: 'BANK' | 'COURSE';
  /** Chỉ có khi sourceKind = 'COURSE'. */
  sourceCourseId: string | null;
  sourceCourseName: string | null;
  /** Tên chương ở nơi nguồn (chương của lớp, hoặc thư mục trong ngân hàng). */
  sourceModuleName: string;
  /** Đường dẫn danh mục, ví dụ "2026-2027 / 12A1". */
  sourceCategoryPath: string;
  /** Mô tả ngắn theo loại: số câu hỏi, số test case, thời lượng… */
  detail: string;
};

// ── Ngân hàng nội dung soạn thẳng trong danh mục khoá học ──────

export type CategoryBankItem = {
  id: string;
  type: string;
  title: string;
  /**
   * Khoá ngoại tới bản ghi nội dung — đúng một trong sáu có giá trị, khớp với
   * `type`. Giao diện cần nó để dựng đường dẫn tới đúng trình soạn.
   */
  lessonId: string | null;
  assignmentId: string | null;
  quizId: string | null;
  codeExerciseId: string | null;
  practiceTestId: string | null;
  forumId: string | null;
  updatedAt: string;
  /** Mô tả ngắn theo loại, ví dụ "20 phút", "12 câu hỏi". */
  detail: string;
};

export type CategoryBankModule = {
  id: string;
  name: string;
  position: number;
  items: CategoryBankItem[];
};

export type CategoryContentBankData = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  modules: CategoryBankModule[];
};

export const BankModuleBodySchema = z.object({
  name: z.string().trim().min(1, 'Tên chương không được để trống').max(200),
});
export type BankModuleBody = z.infer<typeof BankModuleBodySchema>;

export const CreateBankLessonBodySchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
  content: z.string().optional(),
  estimatedMinutes: z.number().int().positive().max(600).nullable().optional(),
});
export type CreateBankLessonBody = z.infer<typeof CreateBankLessonBodySchema>;

/**
 * Loại hoạt động soạn thẳng được trong kho của danh mục.
 *
 * Thiếu FILE / EXTERNAL_URL: hai loại đó không có bản ghi nội dung riêng, chúng
 * chỉ là một đường dẫn gắn trên ModuleItem của một lớp cụ thể.
 * LESSON đi đường riêng (`CreateBankLessonBodySchema`) vì tạo xong là mở thẳng
 * trình soạn nội dung, không qua bước đặt tên.
 */
export const BANK_ACTIVITY_TYPES = [
  'ASSIGNMENT',
  'QUIZ',
  'CODE_EXERCISE',
  'PRACTICE_TEST',
  'FORUM',
] as const;
export type BankActivityType = (typeof BANK_ACTIVITY_TYPES)[number];

/**
 * Tạo khung một hoạt động trong kho: chỉ cần loại và tiêu đề, phần còn lại soạn
 * ở trình soạn riêng của từng loại. Cùng cách làm với "tạo nháp rồi sửa" ở lớp,
 * nên không phải dựng lại toàn bộ biểu mẫu cho ngữ cảnh kho.
 *
 * Riêng đề luyện tập bắt buộc có PDF ngay từ đầu (`PracticeTest.pdfUrl` là cột
 * NOT NULL) nên biểu mẫu của nó gọi thẳng `POST /practice-tests`.
 */
export const CreateBankActivityBodySchema = z.object({
  type: z.enum(BANK_ACTIVITY_TYPES),
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
  /** Chỉ dùng cho CODE_EXERCISE. */
  language: z.enum(['PYTHON3', 'JAVASCRIPT', 'CPP17', 'WEB', 'SCRATCH']).optional(),
});
export type CreateBankActivityBody = z.infer<typeof CreateBankActivityBodySchema>;

/** Chép một hoạt động của lớp thành bản mẫu riêng trong kho. */
export const ImportToBankBodySchema = z.object({
  moduleItemId: z.string().min(1),
});
export type ImportToBankBody = z.infer<typeof ImportToBankBodySchema>;

/** Một hoạt động của lớp mà giáo viên chọn để chép vào kho. */
export type CourseActivityPick = {
  moduleItemId: string;
  type: string;
  title: string;
  moduleName: string;
  detail: string;
};

export type CourseActivityPickGroup = {
  courseId: string;
  courseName: string;
  courseSlug: string;
  items: CourseActivityPick[];
};

export type ContentBankResult = {
  items: ContentBankItem[];
  /** Số khoá học đang góp nội dung mà khoá này nhìn thấy. */
  sourceCourseCount: number;
};
