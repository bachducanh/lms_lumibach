export type GbScoreCell = {
  score: number | null;
  maxScore: number;
  status: string;
};

export type GbColumn = {
  id: string;
  title: string;
  maxScore: number;
  type: 'ASSIGNMENT' | 'QUIZ' | 'CODE' | 'PRACTICE';
};

export type GbStudent = {
  id: string;
  name: string;
  email: string;
  scores: Record<string, GbScoreCell | null>;
};

export type GradebookData = {
  courseId: string;
  columns: GbColumn[];
  students: GbStudent[];
};
