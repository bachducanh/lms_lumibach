-- CreateEnum
CREATE TYPE "GroupMode" AS ENUM ('NO_GROUPS', 'SEPARATE_GROUPS', 'VISIBLE_GROUPS');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "groupSubmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groupingId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "groupMode" "GroupMode" NOT NULL DEFAULT 'NO_GROUPS';

-- AlterTable
ALTER TABLE "ForumTopic" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grouping" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grouping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupingGroup" (
    "id" TEXT NOT NULL,
    "groupingId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "GroupingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_courseId_idx" ON "Group"("courseId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Grouping_courseId_idx" ON "Grouping"("courseId");

-- CreateIndex
CREATE INDEX "GroupingGroup_groupingId_idx" ON "GroupingGroup"("groupingId");

-- CreateIndex
CREATE INDEX "GroupingGroup_groupId_idx" ON "GroupingGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupingGroup_groupingId_groupId_key" ON "GroupingGroup"("groupingId", "groupId");

-- CreateIndex
CREATE INDEX "ForumTopic_groupId_idx" ON "ForumTopic"("groupId");

-- CreateIndex
CREATE INDEX "Submission_groupId_idx" ON "Submission"("groupId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_groupingId_fkey" FOREIGN KEY ("groupingId") REFERENCES "Grouping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grouping" ADD CONSTRAINT "Grouping_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupingGroup" ADD CONSTRAINT "GroupingGroup_groupingId_fkey" FOREIGN KEY ("groupingId") REFERENCES "Grouping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupingGroup" ADD CONSTRAINT "GroupingGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
