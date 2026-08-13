-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "sharedToCategory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Question_sharedToCategory_idx" ON "Question"("sharedToCategory");
