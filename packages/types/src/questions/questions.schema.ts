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
