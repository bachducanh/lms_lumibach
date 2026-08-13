-- AlterEnum
ALTER TYPE "ModuleItemType" ADD VALUE 'FORUM';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "modulesExpandedByDefault" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ForumTopic" ADD COLUMN     "forumId" TEXT;

-- AlterTable
ALTER TABLE "ModuleItem" ADD COLUMN     "forumId" TEXT;

-- CreateTable
CREATE TABLE "Forum" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Forum_courseId_idx" ON "Forum"("courseId");

-- CreateIndex
CREATE INDEX "ForumTopic_forumId_idx" ON "ForumTopic"("forumId");

-- CreateIndex
CREATE INDEX "ModuleItem_forumId_idx" ON "ModuleItem"("forumId");

-- AddForeignKey
ALTER TABLE "ModuleItem" ADD CONSTRAINT "ModuleItem_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forum" ADD CONSTRAINT "Forum_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
