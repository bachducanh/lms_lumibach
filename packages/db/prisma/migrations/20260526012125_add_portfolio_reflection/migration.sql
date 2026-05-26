-- CreateTable
CREATE TABLE "PortfolioReflection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioReflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioReflection_courseId_studentId_idx" ON "PortfolioReflection"("courseId", "studentId");

-- AddForeignKey
ALTER TABLE "PortfolioReflection" ADD CONSTRAINT "PortfolioReflection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioReflection" ADD CONSTRAINT "PortfolioReflection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
