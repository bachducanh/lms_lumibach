-- AlterTable
ALTER TABLE "ModuleItem" ADD COLUMN     "groupMode" "GroupMode" NOT NULL DEFAULT 'NO_GROUPS',
ADD COLUMN     "groupingId" TEXT;

-- CreateTable
CREATE TABLE "ModuleItemGroup" (
    "id" TEXT NOT NULL,
    "moduleItemId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleItemGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleItemGroup_moduleItemId_idx" ON "ModuleItemGroup"("moduleItemId");

-- CreateIndex
CREATE INDEX "ModuleItemGroup_groupId_idx" ON "ModuleItemGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleItemGroup_moduleItemId_groupId_key" ON "ModuleItemGroup"("moduleItemId", "groupId");

-- CreateIndex
CREATE INDEX "ModuleItem_groupingId_idx" ON "ModuleItem"("groupingId");

-- AddForeignKey
ALTER TABLE "ModuleItem" ADD CONSTRAINT "ModuleItem_groupingId_fkey" FOREIGN KEY ("groupingId") REFERENCES "Grouping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemGroup" ADD CONSTRAINT "ModuleItemGroup_moduleItemId_fkey" FOREIGN KEY ("moduleItemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemGroup" ADD CONSTRAINT "ModuleItemGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
