export type AssignmentListItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  maxScore: number;
  dueDate: string | null;
  availableFrom: string | null;
  allowResubmit: boolean;
  latePolicy: string;
  _count: { submissions: number };
};

export type AssignmentModuleGroup = {
  moduleId: string;
  moduleName: string;
  position: number;
  assignments: AssignmentListItem[];
};

export type AssignmentsByModule = {
  groups: AssignmentModuleGroup[];
  standalone: AssignmentListItem[];
};

export type AssignmentDetail = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  maxScore: number;
  weight: number;
  dueDate: string | null;
  availableFrom: string | null;
  lateDeadline: string | null;
  latePolicy: string;
  latePenalty: number | null;
  allowResubmit: boolean;
  maxAttempts: number | null;
  maxFileSizeMb: number | null;
  maxFiles: number | null;
  groupSubmission: boolean;
  groupingId: string | null;
  publishedAt: string | null;
  createdAt: string;
  moduleItems: { id: string; moduleId: string; module: { name: string } }[];
  _count: { submissions: number };
};

export type SubmissionItem = {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  status: string;
  score: number | null;
  feedback: string | null;
  attemptNumber: number;
  submittedAt: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
  files: { id: string; name: string; url: string; size: number; mimeType: string }[];
  student?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  };
};
