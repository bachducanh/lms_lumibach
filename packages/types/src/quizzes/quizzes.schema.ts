export type QuizListItem = {
  id: string;
  title: string;
  status: string;
  timeLimit: number | null;
  dueDate: string | null;
  _count: { questions: number; attempts: number };
};

export type QuizModuleGroup = {
  moduleId: string;
  moduleName: string;
  position: number;
  quizzes: QuizListItem[];
};

export type QuizzesByModule = {
  groups: QuizModuleGroup[];
  standalone: QuizListItem[];
};

export type QuizDetail = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  status: string;
  timeLimit: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResults: boolean;
  availableFrom: string | null;
  dueDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  questions: QuizQuestionItem[];
  _count: { attempts: number };
};

export type QuizQuestionItem = {
  id: string;
  quizId: string;
  questionId: string;
  position: number;
  points: number | null;
  question: {
    id: string;
    type: string;
    content: string;
    explanation: string | null;
    points: number;
    options: { id: string; content: string; isCorrect: boolean; position: number }[];
  };
};

export type QuizPreview = {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  questions: {
    questionId: string;
    position: number;
    points: number;
    question: {
      id: string;
      type: string;
      content: string;
      explanation: string | null;
      starterCode: string | null;
      options: { id: string; content: string; isCorrect: boolean; position: number }[];
    };
  }[];
};

export type PreviewQuizData = QuizPreview;
export type PreviewQuizQuestion = QuizPreview['questions'][number];
