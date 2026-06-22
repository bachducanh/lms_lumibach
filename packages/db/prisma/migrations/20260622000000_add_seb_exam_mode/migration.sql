-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "sebConfigName" TEXT,
ADD COLUMN     "sebConfigUrl" TEXT,
ADD COLUMN     "sebEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PracticeTest" ADD COLUMN     "sebConfigName" TEXT,
ADD COLUMN     "sebConfigUrl" TEXT,
ADD COLUMN     "sebEnabled" BOOLEAN NOT NULL DEFAULT false;
