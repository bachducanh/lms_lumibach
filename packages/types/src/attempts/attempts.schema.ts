export type AttemptQuestion = {
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
};

export type AttemptAnswer = {
  id: string;
  questionId: string;
  selectedOptionIds: string[] | null;
  booleanAnswer: boolean | null;
  textAnswer: string | null;
  isCorrect: boolean | null;
  score: number | null;
  feedback: string | null;
};

export type AttemptData = {
  id: string;
  quizId: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  quiz: {
    title: string;
    timeLimit: number | null;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    showResults: boolean;
    passingScore: number | null;
  };
  questions: AttemptQuestion[];
  answers: AttemptAnswer[];
};

export type AttemptListItem = {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  student?: { id: string; fullName: string | null; firstName: string; lastName: string };
};

export type AttemptDetailRow = {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  student: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  answers: { questionId: string; score: number | null; isCorrect: boolean | null }[];
};

export type QuizQuestionBrief = {
  questionId: string;
  position: number;
  points: number;
};

export type AnswerInput =
  | { type: 'MCQ'; selectedOptionIds: string[] }
  | { type: 'TF'; booleanAnswer: boolean }
  | { type: 'ESSAY'; textAnswer: string };
