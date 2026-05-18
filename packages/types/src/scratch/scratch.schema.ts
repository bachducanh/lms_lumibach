export type MyScratchSubmission = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  submittedAt: Date;
  attemptNumber: number;
  code: string;
  gradedAt: Date | null;
};

export type ScratchSubmissionWithStudent = MyScratchSubmission & {
  studentId: string;
  student: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
};
