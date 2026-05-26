-- Add a PDF-based practice test activity.

ALTER TYPE "ModuleItemType" ADD VALUE IF NOT EXISTS 'PRACTICE_TEST';

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'VIEW_PRACTICE_TEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'START_PRACTICE_TEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SUBMIT_PRACTICE_TEST';

CREATE TYPE "PracticeTestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "PracticeQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE_MULTI', 'SHORT_ANSWER');

ALTER TABLE "ModuleItem" ADD COLUMN "practiceTestId" TEXT;

CREATE TABLE "PracticeTest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PracticeTestStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT NOT NULL,
    "pdfName" TEXT NOT NULL,
    "pdfMimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "pdfSize" INTEGER NOT NULL DEFAULT 0,
    "timeLimit" INTEGER,
    "maxAttempts" INTEGER,
    "showResults" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeTestQuestion" (
    "id" TEXT NOT NULL,
    "practiceTestId" TEXT NOT NULL,
    "type" "PracticeQuestionType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "optionCount" INTEGER NOT NULL DEFAULT 4,
    "statementCount" INTEGER NOT NULL DEFAULT 4,
    "correctAnswer" JSONB NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PracticeTestQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeTestAttempt" (
    "id" TEXT NOT NULL,
    "practiceTestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'GRADED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,

    CONSTRAINT "PracticeTestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeTestAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "statementAnswers" JSONB,
    "textAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION,

    CONSTRAINT "PracticeTestAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeTestAnswer_attemptId_questionId_key" ON "PracticeTestAnswer"("attemptId", "questionId");
CREATE INDEX "PracticeTest_courseId_idx" ON "PracticeTest"("courseId");
CREATE INDEX "PracticeTest_status_idx" ON "PracticeTest"("status");
CREATE INDEX "PracticeTest_deletedAt_idx" ON "PracticeTest"("deletedAt");
CREATE INDEX "PracticeTestQuestion_practiceTestId_idx" ON "PracticeTestQuestion"("practiceTestId");
CREATE INDEX "PracticeTestQuestion_type_idx" ON "PracticeTestQuestion"("type");
CREATE INDEX "PracticeTestAttempt_practiceTestId_idx" ON "PracticeTestAttempt"("practiceTestId");
CREATE INDEX "PracticeTestAttempt_studentId_idx" ON "PracticeTestAttempt"("studentId");
CREATE INDEX "PracticeTestAnswer_attemptId_idx" ON "PracticeTestAnswer"("attemptId");
CREATE INDEX "PracticeTestAnswer_questionId_idx" ON "PracticeTestAnswer"("questionId");

ALTER TABLE "ModuleItem" ADD CONSTRAINT "ModuleItem_practiceTestId_fkey" FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeTest" ADD CONSTRAINT "PracticeTest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeTestQuestion" ADD CONSTRAINT "PracticeTestQuestion_practiceTestId_fkey" FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeTestAttempt" ADD CONSTRAINT "PracticeTestAttempt_practiceTestId_fkey" FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeTestAttempt" ADD CONSTRAINT "PracticeTestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeTestAnswer" ADD CONSTRAINT "PracticeTestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PracticeTestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeTestAnswer" ADD CONSTRAINT "PracticeTestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PracticeTestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
