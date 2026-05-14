import type { CodeLanguage, ExerciseStatus } from '@lumibach/db';

export type CodeExerciseDetail = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  language: CodeLanguage;
  status: ExerciseStatus;
  timeLimit: number;
  memoryLimit: number;
  starterCode: string | null;
  solutionCode: string | null;
  starterHtml: string | null;
  starterCss: string | null;
  starterJs: string | null;
  starterFileUrl: string | null;
  testCases: {
    id: string;
    label: string | null;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    points: number;
    position: number;
  }[];
};

export type RunCodeResult = {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  statusDesc: string;
  time: string | null;
  memory: number | null;
};

export type CodeExerciseListItem = {
  id: string;
  title: string;
  language: CodeLanguage;
  status: ExerciseStatus;
  _count: { submissions: number };
};

export type ExerciseModuleGroup = {
  moduleId: string;
  moduleName: string;
  position: number;
  exercises: CodeExerciseListItem[];
};

export type MyExerciseSubmission = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: Date;
  attemptNumber: number;
  language: CodeLanguage;
};

export type ExerciseSubmissionResult = {
  id: string;
  status: string;
  score: number | null;
  time: number | null;
  memory: number | null;
  testCase: {
    label: string | null;
    position: number;
    isHidden: boolean;
    points: number;
  };
};

export type ExerciseSubmissionDetail = {
  id: string;
  codeExerciseId: string;
  studentId: string;
  language: CodeLanguage;
  code: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  submittedAt: Date;
  attemptNumber: number;
  results: ExerciseSubmissionResult[];
};
