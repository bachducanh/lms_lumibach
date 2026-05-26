-- CreateEnum
CREATE TYPE "CompetencyLevel" AS ENUM ('NO_EVIDENCE', 'BEGINNING', 'APPROACHING', 'PROFICIENT', 'ADVANCED');

-- CreateTable
CREATE TABLE "CompetencyCategory" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyIndicator" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCompetency" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentId" TEXT,
    "quizId" TEXT,
    "codeExerciseId" TEXT,
    "practiceTestId" TEXT,

    CONSTRAINT "ActivityCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessment" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" "CompetencyLevel" NOT NULL,
    "evidenceType" TEXT,
    "note" TEXT,
    "assignmentId" TEXT,
    "quizId" TEXT,
    "codeExerciseId" TEXT,
    "practiceTestId" TEXT,
    "gradedBy" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetencyCategory_courseId_idx" ON "CompetencyCategory"("courseId");

-- CreateIndex
CREATE INDEX "CompetencyIndicator_categoryId_idx" ON "CompetencyIndicator"("categoryId");

-- CreateIndex
CREATE INDEX "ActivityCompetency_indicatorId_idx" ON "ActivityCompetency"("indicatorId");

-- CreateIndex
CREATE INDEX "ActivityCompetency_assignmentId_idx" ON "ActivityCompetency"("assignmentId");

-- CreateIndex
CREATE INDEX "ActivityCompetency_quizId_idx" ON "ActivityCompetency"("quizId");

-- CreateIndex
CREATE INDEX "ActivityCompetency_codeExerciseId_idx" ON "ActivityCompetency"("codeExerciseId");

-- CreateIndex
CREATE INDEX "ActivityCompetency_practiceTestId_idx" ON "ActivityCompetency"("practiceTestId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompetency_indicatorId_assignmentId_key" ON "ActivityCompetency"("indicatorId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompetency_indicatorId_quizId_key" ON "ActivityCompetency"("indicatorId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompetency_indicatorId_codeExerciseId_key" ON "ActivityCompetency"("indicatorId", "codeExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompetency_indicatorId_practiceTestId_key" ON "ActivityCompetency"("indicatorId", "practiceTestId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_studentId_idx" ON "CompetencyAssessment"("studentId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_indicatorId_idx" ON "CompetencyAssessment"("indicatorId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_assignmentId_idx" ON "CompetencyAssessment"("assignmentId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_quizId_idx" ON "CompetencyAssessment"("quizId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_codeExerciseId_idx" ON "CompetencyAssessment"("codeExerciseId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_practiceTestId_idx" ON "CompetencyAssessment"("practiceTestId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessment_indicatorId_studentId_assignmentId_key" ON "CompetencyAssessment"("indicatorId", "studentId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessment_indicatorId_studentId_quizId_key" ON "CompetencyAssessment"("indicatorId", "studentId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessment_indicatorId_studentId_codeExerciseId_key" ON "CompetencyAssessment"("indicatorId", "studentId", "codeExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessment_indicatorId_studentId_practiceTestId_key" ON "CompetencyAssessment"("indicatorId", "studentId", "practiceTestId");

-- AddForeignKey
ALTER TABLE "CompetencyCategory" ADD CONSTRAINT "CompetencyCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyIndicator" ADD CONSTRAINT "CompetencyIndicator_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetencyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCompetency" ADD CONSTRAINT "ActivityCompetency_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "CompetencyIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCompetency" ADD CONSTRAINT "ActivityCompetency_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCompetency" ADD CONSTRAINT "ActivityCompetency_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCompetency" ADD CONSTRAINT "ActivityCompetency_codeExerciseId_fkey" FOREIGN KEY ("codeExerciseId") REFERENCES "CodeExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCompetency" ADD CONSTRAINT "ActivityCompetency_practiceTestId_fkey" FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "CompetencyIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_codeExerciseId_fkey" FOREIGN KEY ("codeExerciseId") REFERENCES "CodeExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_practiceTestId_fkey" FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
