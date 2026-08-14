import { z } from 'zod';

export type QuestionOption = {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
};

export type QuestionTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  position: number;
};

export type QuestionItem = {
  id: string;
  type: string;
  content: string;
  explanation: string | null;
  points: number;
  categoryId: string | null;
  options: QuestionOption[];
  testCases: QuestionTestCase[];
  starterCode: string | null;
  solutionCode: string | null;
  timeLimit: number | null;
  memoryLimit: number | null;
  createdAt: string;
  /** Đã đưa vào ngân hàng chung của danh mục khoá học chưa. */
  sharedToCategory?: boolean;
};

export type QuestionCategory = {
  id: string;
  name: string;
  position: number;
  _count: { questions: number };
};

export type CategoryWithQuestions = {
  id: string;
  name: string;
  position: number;
  questions: QuestionItem[];
};

export type QuestionBankData = {
  categories: CategoryWithQuestions[];
  uncategorized: QuestionItem[];
};

export type QuizBankGroup = {
  id: string;
  title: string;
  questions: { id: string; type: string; content: string; points: number }[];
};

export type TCCheckResult = {
  position: number;
  isHidden: boolean;
  passed: boolean;
  statusId: number;
  statusDesc: string;
  input: string | null;
  expected: string | null;
  actual: string | null;
  errorDetail: string | null;
};

// ── Ngân hàng câu hỏi dùng chung theo danh mục khoá học ────────

export const ShareQuestionBodySchema = z.object({
  shared: z.boolean(),
});
export type ShareQuestionBody = z.infer<typeof ShareQuestionBodySchema>;

export const QuestionBankQuerySchema = z.object({
  /** Khoá học đang đứng — quyết định nhánh danh mục được phép nhìn. */
  courseId: z.string().min(1),
  q: z.string().trim().optional(),
  type: z.string().trim().optional(),
});
export type QuestionBankQuery = z.infer<typeof QuestionBankQuerySchema>;

export const CopyQuestionBodySchema = z.object({
  /** Khoá học nhận bản sao. */
  courseId: z.string().min(1),
  /** Kho câu hỏi trong khoá nhận; bỏ trống thì để ngoài danh mục. */
  categoryId: z.string().min(1).nullable().optional(),
});
export type CopyQuestionBody = z.infer<typeof CopyQuestionBodySchema>;

/** Một câu hỏi trong ngân hàng chung, kèm nguồn gốc để giáo viên biết của lớp nào. */
export type BankQuestionItem = {
  id: string;
  type: string;
  content: string;
  points: number;
  optionCount: number;
  createdAt: string;
  /**
   * Câu hỏi vào ngân hàng bằng hai đường khác nhau, và giáo viên cần phân biệt:
   * - `BANK`   — soạn thẳng trong ngân hàng của danh mục, là nội dung dùng chung
   *              có chủ đích, không thuộc lớp nào.
   * - `COURSE` — của một lớp cụ thể, được giáo viên lớp đó bật chia sẻ.
   */
  sourceKind: 'BANK' | 'COURSE';
  /** Chỉ có khi sourceKind = 'COURSE'. */
  sourceCourseId: string | null;
  sourceCourseName: string | null;
  /** Đường dẫn danh mục, ví dụ "Tin học / Khối 10 / 10E2". */
  sourceCategoryPath: string;
  /** Tên thư mục chứa câu hỏi ở nơi nguồn (nếu có). */
  sourceCategoryName: string | null;
};

export type QuestionBankResult = {
  questions: BankQuestionItem[];
  /** Số khoá học đang góp câu hỏi vào ngân hàng mà khoá này nhìn thấy. */
  sourceCourseCount: number;
};

// ── Kho câu hỏi soạn thẳng trong danh mục khoá học ─────────────
//
// Khác với phần trên: đây là nội dung KHÔNG thuộc khoá nào, sống trong danh mục.
// Các khoá cùng nhánh nhìn thấy qua đúng trang "Ngân hàng chung" và chép về.

/** Một danh mục mà người dùng hiện tại được phép soạn kho. */
export type ManageableBankCategory = {
  id: string;
  name: string;
  /** Đường dẫn đầy đủ, ví dụ "Tin học / Khối 10". */
  path: string;
  questionCount: number;
  /** Số chương (thư mục) trong ngân hàng nội dung của danh mục. */
  moduleCount: number;
};

export type CategoryQuestionBankData = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  /** Thư mục trong kho; câu hỏi không xếp thư mục nằm ở `uncategorized`. */
  folders: CategoryWithQuestions[];
  uncategorized: QuestionItem[];
};

export const BankFolderBodySchema = z.object({
  name: z.string().trim().min(1, 'Tên thư mục không được để trống').max(120),
});
export type BankFolderBody = z.infer<typeof BankFolderBodySchema>;
