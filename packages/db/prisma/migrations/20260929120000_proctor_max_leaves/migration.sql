-- AlterEnum
ALTER TYPE "ProctorEventType" ADD VALUE 'AUTO_SUBMITTED';

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "proctorMaxLeaves" INTEGER;

