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
  sourceCourseId: string;
  sourceCourseName: string;
  /** Đường dẫn danh mục của khoá nguồn, ví dụ "Tin học / Khối 10 / 10E2". */
  sourceCategoryPath: string;
  /** Tên kho câu hỏi trong khoá nguồn (nếu có). */
  sourceCategoryName: string | null;
};

export type QuestionBankResult = {
  questions: BankQuestionItem[];
  /** Số khoá học đang góp câu hỏi vào ngân hàng mà khoá này nhìn thấy. */
  sourceCourseCount: number;
};
