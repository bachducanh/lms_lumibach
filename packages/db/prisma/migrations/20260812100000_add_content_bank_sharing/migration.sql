-- AlterTable
ALTER TABLE "ModuleItem" ADD COLUMN     "sharedToCategory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ModuleItem_sharedToCategory_idx" ON "ModuleItem"("sharedToCategory");
