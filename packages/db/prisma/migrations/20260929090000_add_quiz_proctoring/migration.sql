-- CreateEnum
CREATE TYPE "ProctorEventType" AS ENUM ('SESSION_START', 'TAB_HIDDEN', 'WINDOW_BLUR', 'PAGE_LEFT', 'SHARE_STOPPED');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "proctorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proctorScreenshot" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "proctorAwayMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proctorLeaveCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuizProctorEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "ProctorEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "meta" JSONB,

    CONSTRAINT "QuizProctorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizProctorSnapshot" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventId" TEXT,
    "bucket" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "capturedAtClient" TIMESTAMP(3),
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizProctorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizProctorEvent_attemptId_occurredAt_idx" ON "QuizProctorEvent"("attemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "QuizProctorSnapshot_attemptId_idx" ON "QuizProctorSnapshot"("attemptId");

-- CreateIndex
CREATE INDEX "QuizProctorSnapshot_eventId_idx" ON "QuizProctorSnapshot"("eventId");

-- AddForeignKey
ALTER TABLE "QuizProctorEvent" ADD CONSTRAINT "QuizProctorEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizProctorSnapshot" ADD CONSTRAINT "QuizProctorSnapshot_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizProctorSnapshot" ADD CONSTRAINT "QuizProctorSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "QuizProctorEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

