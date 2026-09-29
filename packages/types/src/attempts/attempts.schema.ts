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
  proctorLeaveCount: number;
  proctorAwayMs: number;
  /** Bài bị hệ thống tự nộp vì rời bài quá số lần cho phép. */
  proctorAutoSubmitted: boolean;
  quiz: {
    title: string;
    timeLimit: number | null;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    showResults: boolean;
    passingScore: number | null;
    proctorEnabled: boolean;
    proctorScreenshot: boolean;
    proctorMaxLeaves: number | null;
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
  proctorLeaveCount: number;
  proctorAwayMs: number;
  /** proctorEvents: chỉ đếm sự kiện AUTO_SUBMITTED (0 hoặc 1). */
  _count: { proctorSnapshots: number; proctorEvents: number };
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

// ── Giám sát rời bài ─────────────────────────────────────────

export type ProctorEventType =
  | 'SESSION_START'
  | 'TAB_HIDDEN'
  | 'WINDOW_BLUR'
  | 'PAGE_LEFT'
  | 'SHARE_STOPPED'
  | 'AUTO_SUBMITTED';

/** Các loại sự kiện tính là một lần rời bài. */
export const PROCTOR_LEAVE_TYPES: readonly ProctorEventType[] = [
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'PAGE_LEFT',
];

export type ProctorSnapshotItem = {
  id: string;
  /** Đường dẫn có kiểm quyền, dùng thẳng làm `src` của ảnh. */
  url: string;
  width: number;
  height: number;
  serverReceivedAt: string;
};

export type ProctorEventItem = {
  id: string;
  type: ProctorEventType;
  occurredAt: string;
  durationMs: number | null;
  meta: Record<string, unknown> | null;
  snapshots: ProctorSnapshotItem[];
};

export type ProctorReport = {
  attemptId: string;
  leaveCount: number;
  awayMs: number;
  /** Giới hạn số lần rời của quiz lúc xem báo cáo. null = không tự nộp. */
  maxLeaves: number | null;
  events: ProctorEventItem[];
};
