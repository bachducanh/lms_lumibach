-- CreateTable
CREATE TABLE "CompetencyAssessmentPeriod" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyAssessmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyLevelTarget" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startLevel" INTEGER NOT NULL,
    "targetLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyLevelTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetencyAssessmentPeriod_courseId_idx" ON "CompetencyAssessmentPeriod"("courseId");

-- CreateIndex
CREATE INDEX "CompetencyLevelTarget_periodId_idx" ON "CompetencyLevelTarget"("periodId");

-- CreateIndex
CREATE INDEX "CompetencyLevelTarget_categoryId_idx" ON "CompetencyLevelTarget"("categoryId");

-- CreateIndex
CREATE INDEX "CompetencyLevelTarget_studentId_idx" ON "CompetencyLevelTarget"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyLevelTarget_periodId_categoryId_studentId_key" ON "CompetencyLevelTarget"("periodId", "categoryId", "studentId");

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentPeriod" ADD CONSTRAINT "CompetencyAssessmentPeriod_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyLevelTarget" ADD CONSTRAINT "CompetencyLevelTarget_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CompetencyAssessmentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyLevelTarget" ADD CONSTRAINT "CompetencyLevelTarget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetencyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyLevelTarget" ADD CONSTRAINT "CompetencyLevelTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
