export type PracticeTestStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type PracticeQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE_MULTI' | 'SHORT_ANSWER';

export type PracticeAnswerKey =
  | { option: string }
  | { statements: boolean[]; scoreByCorrectCount?: number[] }
  | { answers: string[] };

export type PracticeQuestionInput = {
  id?: string;
  type: PracticeQuestionType;
  prompt?: string | null;
  points?: number;
  optionCount?: number;
  statementCount?: number;
  correctOption?: string | null;
  correctStatements?: boolean[];
  scoreByCorrectCount?: number[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
};

export type PracticeTestFile = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export type PracticeTestListItem = {
  id: string;
  title: string;
  status: PracticeTestStatus;
  timeLimit: number | null;
  dueDate: string | null;
  _count: { questions: number; attempts: number };
};

export type PracticeTestModuleGroup = {
  moduleId: string;
  moduleName: string;
  position: number;
  practiceTests: PracticeTestListItem[];
};

export type PracticeTestsByModule = {
  groups: PracticeTestModuleGroup[];
  standalone: PracticeTestListItem[];
};

export type PracticeTestQuestion = {
  id: string;
  practiceTestId: string;
  type: PracticeQuestionType;
  position: number;
  prompt: string | null;
  points: number;
  optionCount: number;
  statementCount: number;
  correctAnswer: PracticeAnswerKey | null;
  caseSensitive: boolean;
};

export type PracticeTestDetail = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  status: PracticeTestStatus;
  pdfUrl: string;
  pdfName: string;
  pdfMimeType: string;
  pdfSize: number;
  timeLimit: number | null;
  maxAttempts: number | null;
  showResults: boolean;
  availableFrom: string | null;
  dueDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  questions: PracticeTestQuestion[];
  moduleItems?: { id: string; moduleId: string; module: { name: string } }[];
  _count: { questions: number; attempts: number };
};

export type PracticeTestPreview = PracticeTestDetail;

export type PracticeStudentAnswerInput = {
  questionId: string;
  selectedOption?: string | null;
  statementAnswers?: (boolean | null)[] | null;
  textAnswer?: string | null;
};

export type PracticeSubmitResult = {
  attemptId: string;
  score: number;
  maxScore: number;
};

export type PracticeAttemptAnswer = {
  id: string;
  questionId: string;
  selectedOption: string | null;
  statementAnswers: (boolean | null)[] | null;
  textAnswer: string | null;
  isCorrect: boolean | null;
  score: number | null;
};

export type PracticeAttemptDetail = {
  id: string;
  practiceTestId: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string;
  score: number | null;
  maxScore: number | null;
  practiceTest: PracticeTestDetail;
  answers: PracticeAttemptAnswer[];
  student?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type PracticeAttemptListItem = {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  student?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email?: string;
  };
  answers?: {
    questionId: string;
    statementAnswers: (boolean | null)[] | null;
    isCorrect: boolean | null;
    score: number | null;
  }[];
};
